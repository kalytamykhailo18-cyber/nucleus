import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { normalizeEmail } from '@/lib/email';
import { stripe } from '@/lib/stripe';
import {
  fetchPlanByType,
  grossCentsForNet,
  SHIPPING_NET_CENTAVOS,
  type BillingCadence,
  type PlanType,
} from '@/lib/plans';
import {
  SIGNUP_SOURCE_COOKIE,
  resolveSignupSource,
  sanitizeSource,
} from '@/lib/signup-source';
import { syncContact } from '@/lib/hubspot';

/**
 * Creates a pending User + Subscription pair, then a Stripe PaymentIntent
 * for the plan's monthly price. Returns the clientSecret so the browser
 * can confirm the card with Stripe Elements.
 *
 * If the email already exists, we 409 — checkout is for new accounts.
 * Existing customers should sign in and upgrade from the dashboard
 * (Phase B work).
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  planType: z.enum(['ANGELA_ESENCIAL', 'ANGELA_TOTAL']),
  email: z.string().email(),
  password: z.string().min(8).max(1024),
  fullName: z.string().min(1).max(255),
  phone: z.string().max(40).nullable().optional(),
  // 2026-05-26 pricing pivot. Optional during the migration so plans
  // without cadence prices configured still flow through the legacy
  // single-monitoringPrice path.
  cadence: z.enum(['MONTHLY', 'SEMESTRAL', 'ANNUAL']).optional(),
  // Partner promo code (e.g. PEMEX10 — 10% off annual prepay total).
  // Optional. When provided, validated against the PromoCode table:
  // unknown code, expired window, or cadence mismatch all 422 with a
  // user-facing Spanish message; valid codes apply their percent off
  // the relevant slice (recurring only, or recurring + initial fee +
  // shipping, depending on applyToInitialFee).
  promo: z.string().min(1).max(40).optional(),
  // Marketing-attribution source from the checkout URL (Phase A+ #2,
  // 2026-06-10). Already whitelisted client-side; server re-sanitizes.
  source: z.string().max(40).optional().nullable(),
});

function cadencePriceForPlan(
  plan: {
    priceMonthlyCents: number | null;
    priceSemestralCents: number | null;
    priceAnnualCents: number | null;
  },
  cadence: BillingCadence,
): number | null {
  switch (cadence) {
    case 'MONTHLY':
      return plan.priceMonthlyCents;
    case 'SEMESTRAL':
      return plan.priceSemestralCents;
    case 'ANNUAL':
      return plan.priceAnnualCents;
  }
}

export async function POST(request: NextRequest) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', message: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 422 },
    );
  }

  const email = normalizeEmail(parsed.data.email);
  if (!email) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 422 });
  }

  // Block duplicate signups — same case-insensitive collation as auth.
  const existing = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "User" WHERE LOWER(email) = ${email} LIMIT 1
  `;
  if (existing.length > 0) {
    return NextResponse.json(
      {
        error: 'Email exists',
        message: 'Ya hay una cuenta con ese email. Inicia sesión para continuar.',
      },
      { status: 409 },
    );
  }

  const plan = await fetchPlanByType(parsed.data.planType as PlanType);
  if (!plan) {
    return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
  }

  // 2026-05-26 pricing pivot: when the requested cadence resolves to
  // a configured price, charge the one-time initial fee + the recurring
  // first-period together upfront. Plans without a cadence configured
  // (or callers that don't pass cadence) fall back to the legacy
  // single-monitoringPrice path so existing flows keep working through
  // the migration.
  const cadence = parsed.data.cadence ?? null;
  const cadenceNetCents =
    cadence !== null ? cadencePriceForPlan(plan, cadence) : null;
  const useCadencePricing =
    cadenceNetCents !== null && plan.initialFeeCents !== null;

  const initialFeeGross = useCadencePricing
    ? grossCentsForNet(plan.initialFeeCents!)
    : 0;
  // Envío is a flat one-time line per Juan 2026-05-28: $500 MXN gross,
  // billed alongside Dispositivo + Activación for cadence-aware buys.
  // Legacy single-monthly flows pre-pivot stay shipping-free.
  const shippingGross = useCadencePricing
    ? grossCentsForNet(SHIPPING_NET_CENTAVOS)
    : 0;
  const recurringGross = useCadencePricing
    ? grossCentsForNet(cadenceNetCents!)
    : grossCentsForNet(plan.monthlyPriceCents);
  const rawGrossCents = initialFeeGross + shippingGross + recurringGross;

  // Promo redemption — validate the code, compute the discount, and
  // persist both the code reference and the actual amount discounted
  // on the Subscription row. The amount lives on the row (instead of
  // being re-derived later from PromoCode.percentOffBps) because the
  // partner's negotiated rate can change after a redemption and the
  // historical charge must remain reproducible for refunds + reporting.
  let promoCodeId: string | null = null;
  let discountAmountCentavos = 0;
  if (parsed.data.promo) {
    const code = parsed.data.promo.trim().toUpperCase();
    const promo = await prisma.promoCode.findUnique({ where: { code } });
    const now = new Date();
    if (
      !promo ||
      (promo.validFrom && promo.validFrom > now) ||
      (promo.validUntil && promo.validUntil < now)
    ) {
      return NextResponse.json(
        { error: 'Promo invalid', message: 'El código promocional no es válido.' },
        { status: 422 },
      );
    }
    if (promo.cadenceLock && promo.cadenceLock !== (cadence ?? null)) {
      return NextResponse.json(
        {
          error: 'Promo cadence mismatch',
          message: `Este código requiere cadencia ${promo.cadenceLock.toLowerCase()}.`,
        },
        { status: 422 },
      );
    }
    if (promo.maxRedemptions !== null) {
      const redeemed = await prisma.subscription.count({
        where: { promoCodeId: code },
      });
      if (redeemed >= promo.maxRedemptions) {
        return NextResponse.json(
          { error: 'Promo exhausted', message: 'Este código ya alcanzó su límite de canjes.' },
          { status: 422 },
        );
      }
    }
    const discountedSlice = promo.applyToInitialFee
      ? rawGrossCents
      : recurringGross;
    discountAmountCentavos = Math.round(
      (discountedSlice * promo.percentOffBps) / 10_000,
    );
    promoCodeId = code;
  }
  const grossCents = rawGrossCents - discountAmountCentavos;

  // Resolve marketing-attribution source — cookie > query > promo.channel.
  // Sticky-first cookie persists the original ad campaign; the query
  // param falls in as a hint for buyers who never hit a page that set the
  // cookie; promo.channel is the partner fallback (PEMEX10 → "pemex").
  const cookieSource = request.cookies.get(SIGNUP_SOURCE_COOKIE)?.value ?? null;
  const signupSource = await resolveSignupSource({
    cookieValue: cookieSource,
    querySource: sanitizeSource(parsed.data.source ?? null),
    promoCode: promoCodeId,
  });

  // Create the User + Subscription in one transaction. Both rows are
  // PENDING until the Stripe webhook (or the client's finalize call)
  // marks the Subscription ACTIVE.
  const { user, subscription } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        passwordHash: hashPassword(parsed.data.password),
        fullName: parsed.data.fullName,
        phone: parsed.data.phone ?? null,
        isActive: true,
        signupSource,
        // Questionnaire is collected post-payment at /onboarding/questionnaire,
        // not here. The dashboard gates on this flag and bounces unfinished
        // signups back to finish the senior's profile before letting them in.
        questionnaireCompleted: false,
      },
      select: { id: true, email: true },
    });
    const subscription = await tx.subscription.create({
      data: {
        userId: user.id,
        planId: plan.id,
        status: 'PENDING_PAYMENT',
        purchaseType: 'SUBSCRIPTION',
        amountPaidCentavos: grossCents,
        // Cadence + initial-fee bookkeeping so the dashboard can render
        // "Renewal · 12 ago 2027" + the cadence label, and so admin
        // reports separate the one-time charge from the recurring one.
        cadence: useCadencePricing ? cadence : null,
        // Bundle shipping into the persisted one-time amount so admin
        // reporting (and the dashboard renewal copy) treats it as part
        // of the upfront fee rather than the recurring servicio.
        initialFeePaidCentavos: useCadencePricing
          ? initialFeeGross + shippingGross
          : null,
        // Promo redemption — null when no code was applied, populated
        // when a partner discount was honored. Both fields move together
        // so admin reporting can join straight off promoCodeId.
        promoCodeId: promoCodeId,
        discountAmountCentavos: discountAmountCentavos > 0
          ? discountAmountCentavos
          : null,
      },
      select: { id: true },
    });
    return { user, subscription };
  });

  // Verification-traffic guard: signups landing on the @nucleus-test.local
  // domain are internal Playwright runs (2026-06-10). They never confirm
  // a card so every previous one minted a permanent "Incomplete"
  // PaymentIntent that cluttered Juan's live Stripe dashboard. Short-
  // circuit Stripe entirely for those emails, return a stub clientSecret
  // so the spec still sees a happy POST, and keep the User + Subscription
  // rows real so the rest of the assertions stand.
  const isVerificationTraffic = user.email.endsWith('@nucleus-test.local');

  let clientSecret: string | null = null;

  if (!isVerificationTraffic) {
    // Mint a Stripe Customer up-front and attach the PaymentIntent to it
    // so the Customer Portal (Juan 2026-06-08 ask) sees the full charge
    // history when the buyer clicks "Administrar suscripción" later. The
    // Customer id is persisted on the User row; subsequent purchases by
    // the same buyer reuse it instead of creating a parallel customer.
    const customer = await stripe().customers.create({
      email: user.email,
      name: parsed.data.fullName,
      phone: parsed.data.phone ?? undefined,
      metadata: { nucleusUserId: user.id },
    });
    await prisma.user.update({
      where: { id: user.id },
      data: { stripeCustomerId: customer.id },
    });

    const intent = await stripe().paymentIntents.create({
      amount: grossCents,
      currency: 'mxn',
      description: `${plan.name} (primer mes)`,
      customer: customer.id,
      receipt_email: user.email,
      automatic_payment_methods: { enabled: true },
      metadata: {
        nucleusSubscriptionId: subscription.id,
        nucleusUserId: user.id,
        planType: plan.type,
      },
    });

    // Store the PaymentIntent id on the Subscription so the webhook + the
    // finalize call can correlate without trusting client input.
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { stripePaymentIntentId: intent.id },
    });
    clientSecret = intent.client_secret;
  } else {
    // Stripe-shaped placeholder so the client-side Stripe Elements SDK
    // parses the secret without throwing. The Elements iframe will fail
    // to fetch a non-existent intent and show an error state — that is
    // fine: verification specs assert on POST shape, not on the iframe
    // contents.
    clientSecret = `pi_e2etest${subscription.id.slice(0, 8)}_secret_e2etest`;
  }

  // Fire-and-forget HubSpot upsert. Wrapped in a Promise so a slow
  // HubSpot HTTP call never delays the PaymentIntent return — checkout
  // UX stays snappy even when HubSpot is having a bad day.
  const promoChannel = promoCodeId
    ? (await prisma.promoCode.findUnique({
        where: { code: promoCodeId },
        select: { channel: true },
      }))?.channel ?? null
    : null;
  void syncContact({
    email: user.email,
    fullName: parsed.data.fullName,
    phone: parsed.data.phone ?? null,
    signupSource,
    planType: plan.type,
    pricePaidCentavos: grossCents,
    channel: promoChannel,
  });

  return NextResponse.json({
    clientSecret,
    subscriptionId: subscription.id,
  });
}
