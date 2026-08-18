import crypto from 'node:crypto';
import { prisma } from '@/lib/db';
import { stripe } from '@/lib/stripe';
import { env } from '@/lib/env';
import { normalizeEmail } from '@/lib/email';
import {
  fetchPlanByType,
  grossCentsForNet,
  SHIPPING_NET_CENTAVOS,
  type PlanType,
} from '@/lib/plans';
import { sendEmail } from '@/lib/email-transport';

/**
 * WhatsApp assisted-sales rail (Juan 2026-06-20). The sales team sends
 * a Stripe Payment Link directly through WhatsApp to leads who already
 * said "yes, I want it" but cannot get through the full app signup
 * flow comfortably (older adults, less tech-savvy regions).
 *
 * The shape:
 *   1. Admin calls `createAssistedSaleLink` with name + phone + email +
 *      planType. We mint a Stripe Payment Link with the same upfront
 *      total Plan A charges today ($2,461 initial + $250 shipping =
 *      $2,711 gross), and a metadata block our webhook recognises.
 *   2. Customer pays. Stripe fires `payment_intent.succeeded`.
 *   3. `provisionFromAssistedSalePayment` runs: it creates a User row
 *      (or reuses one if the email already exists), creates an ACTIVE
 *      Subscription with the pricing-split semantics (cadence MONTHLY,
 *      currentPeriodEnd = now + ASSISTED_FIRST_MONTH_DELAY_DAYS), and
 *      mints a one-shot password-reset token. The customer gets an
 *      email + we return the URL so the admin can also paste it into
 *      WhatsApp manually if needed.
 *   4. The customer clicks the link, sets a password, and lands on
 *      /onboarding/questionnaire (the dashboard's existing redirect
 *      logic handles this — no special routing needed).
 */

const TOKEN_BYTES = 32;
const TOKEN_TTL_HOURS = 72; // generous, since the link rides WhatsApp and may sit unread overnight

export interface CreateAssistedSaleLinkArgs {
  email: string;
  fullName: string;
  phone: string;
  planType: PlanType;
}

export interface CreateAssistedSaleLinkResult {
  paymentLinkId: string;
  paymentLinkUrl: string;
}

export async function createAssistedSaleLink(
  args: CreateAssistedSaleLinkArgs,
): Promise<CreateAssistedSaleLinkResult> {
  const email = normalizeEmail(args.email);
  if (!email) throw new Error('invalid email');

  const plan = await fetchPlanByType(args.planType);
  if (!plan) throw new Error(`plan not found: ${args.planType}`);
  if (plan.initialFeeCents === null) {
    throw new Error(`plan ${args.planType} is missing initialFeeCents`);
  }

  // Upfront slice ONLY — initial fee + shipping. The first monthly
  // cycle is collected by the renewal worker three days later off the
  // saved card, exactly like Plan A's pricing-split flow.
  const initialFeeGross = grossCentsForNet(plan.initialFeeCents);
  const shippingGross = grossCentsForNet(SHIPPING_NET_CENTAVOS);
  let totalGross = initialFeeGross + shippingGross;

  // Auto-apply a currently-running holiday promo (Juan 2026-06-22:
  // 10% Día del Padre, expires 2026-06-30). Mirrors the same logic
  // /api/checkout/start runs on the standard signup path, so a
  // WhatsApp buyer pays the same discounted amount as a buyer who
  // walked in through the web flow.
  const now = new Date();
  const holiday = await prisma.promoCode.findFirst({
    where: {
      channel: { startsWith: 'holiday-' },
      applyToInitialFee: true,
      validFrom: { lte: now },
      validUntil: { gte: now },
    },
    orderBy: { percentOffBps: 'desc' },
  });
  let discountLabel: string | null = null;
  if (holiday) {
    const discount = Math.round((totalGross * holiday.percentOffBps) / 10_000);
    totalGross -= discount;
    discountLabel = holiday.label;
  }

  // Stripe Payment Links need a Price object. We use ad-hoc Price
  // creation (one-shot) so we don't need a permanent Stripe Price row
  // per lead. `inline_price_data` is supported on Payment Link creation.
  const link = await stripe().paymentLinks.create({
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'mxn',
          product_data: {
            name: discountLabel
              ? `${plan.name} — Sensu Angela (incluye ${discountLabel})`
              : `${plan.name} — Sensu Angela (asistido por WhatsApp)`,
          },
          unit_amount: totalGross,
        },
      } as unknown as Parameters<
        ReturnType<typeof stripe>['paymentLinks']['create']
      >[0]['line_items'][number],
    ],
    after_completion: {
      type: 'redirect',
      redirect: {
        url: `${env.AUTH_URL}/checkout/return?assisted=1`,
      },
    },
    metadata: {
      assistedSale: 'true',
      planType: plan.type,
      assistedFullName: args.fullName,
      assistedPhone: args.phone,
      assistedEmail: email,
      // Pricing-split control rides through to payment_intent metadata
      // when the link is consumed, so the webhook plants currentPeriodEnd
      // ASSISTED_FIRST_MONTH_DELAY_DAYS out from activation.
      firstMonthChargeDelayDays: env.ASSISTED_FIRST_MONTH_DELAY_DAYS.toString(),
    },
    payment_intent_data: {
      metadata: {
        assistedSale: 'true',
        planType: plan.type,
        assistedFullName: args.fullName,
        assistedPhone: args.phone,
        assistedEmail: email,
        firstMonthChargeDelayDays: env.ASSISTED_FIRST_MONTH_DELAY_DAYS.toString(),
      },
    },
  });

  return { paymentLinkId: link.id, paymentLinkUrl: link.url };
}

/**
 * Idempotent: safe to call twice with the same intent. The second call
 * finds the existing Subscription and returns its id without minting a
 * fresh row or sending a duplicate email.
 */
export async function provisionFromAssistedSalePayment(
  intent: {
    id: string;
    customer: string | null;
    metadata: Record<string, string | undefined>;
    amount_received: number;
  },
): Promise<{ ok: true; subscriptionId: string; alreadyProvisioned: boolean }> {
  if (intent.metadata.assistedSale !== 'true') {
    throw new Error('not an assisted-sale intent');
  }
  const email = normalizeEmail(intent.metadata.assistedEmail ?? '');
  const fullName = intent.metadata.assistedFullName?.trim() || '(sin nombre)';
  const phone = intent.metadata.assistedPhone?.trim() || null;
  const planType = (intent.metadata.planType ?? '') as PlanType;
  if (!email) throw new Error('assisted-sale intent missing email metadata');
  if (!planType) throw new Error('assisted-sale intent missing planType metadata');

  const plan = await fetchPlanByType(planType);
  if (!plan) throw new Error(`plan not found: ${planType}`);

  // If a Subscription already exists for this PaymentIntent, the
  // webhook is retrying — bail out idempotently.
  const existing = await prisma.subscription.findFirst({
    where: { stripePaymentIntentId: intent.id },
    select: { id: true },
  });
  if (existing) {
    return { ok: true, subscriptionId: existing.id, alreadyProvisioned: true };
  }

  const existingUserRow = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "User" WHERE LOWER(email) = ${email} LIMIT 1
  `;
  const userId =
    existingUserRow[0]?.id ??
    (
      await prisma.user.create({
        data: {
          email,
          fullName,
          phone,
          isActive: true,
          questionnaireCompleted: false,
          signupSource: 'assisted_sale',
        },
        select: { id: true },
      })
    ).id;

  if (intent.customer && existingUserRow[0]) {
    // Update an existing User with the Stripe Customer id if it doesn't
    // have one yet — keeps the Customer Portal lookup consistent.
    await prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: intent.customer },
    });
  } else if (intent.customer) {
    await prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: intent.customer },
    });
  }

  const now = new Date();
  const delayDaysRaw = intent.metadata.firstMonthChargeDelayDays;
  const delayDays = delayDaysRaw ? parseInt(delayDaysRaw, 10) : NaN;
  const periodEnd = new Date(now);
  if (Number.isFinite(delayDays) && delayDays > 0 && delayDays < 30) {
    periodEnd.setDate(periodEnd.getDate() + delayDays);
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  }

  const subscription = await prisma.subscription.create({
    data: {
      userId,
      planId: plan.id,
      status: 'ACTIVE',
      purchaseType: 'SUBSCRIPTION',
      amountPaidCentavos: intent.amount_received,
      cadence: 'MONTHLY',
      startDate: now,
      purchaseDate: now,
      currentPhase: 1,
      currentPeriodEnd: periodEnd,
      stripePaymentIntentId: intent.id,
    },
    select: { id: true },
  });

  // Mint a one-shot password-reset token so the customer can set their
  // password and land on the questionnaire. Same primitive as the
  // forgot-password flow.
  const rawToken = crypto.randomBytes(TOKEN_BYTES).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60_000);
  await prisma.passwordReset.create({
    data: { userId, tokenHash, expiresAt },
  });

  const url = `${env.AUTH_URL}/reset-password?token=${rawToken}`;
  await sendEmail({
    to: email,
    subject: '¡Pago confirmado! Configura tu Sensu Angela',
    text: [
      `Hola, ${fullName.split(' ')[0] ?? ''}.`,
      '',
      'Recibimos tu pago. ¡Bienvenida(o) a Sensu!',
      '',
      'Falta un paso para activar el servicio. Abre el siguiente enlace para crear tu contraseña y completar el cuestionario del usuario de la Angela:',
      '',
      url,
      '',
      `El enlace caduca en ${TOKEN_TTL_HOURS} horas. Si necesitas otro, responde este correo.`,
      '',
      '— Sensu',
    ].join('\n'),
    html: `
      <p>Hola, ${fullName.split(' ')[0] ?? ''}.</p>
      <p>Recibimos tu pago. <strong>¡Bienvenida(o) a Sensu!</strong></p>
      <p>Falta un paso para activar el servicio. Abre el siguiente enlace para crear tu contraseña y completar el cuestionario del usuario de la Angela:</p>
      <p><a href="${url}">${url}</a></p>
      <p>El enlace caduca en ${TOKEN_TTL_HOURS} horas. Si necesitas otro, responde este correo.</p>
      <p>— Sensu</p>
    `,
  });

  return { ok: true, subscriptionId: subscription.id, alreadyProvisioned: false };
}
