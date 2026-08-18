import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { normalizeEmail } from '@/lib/email';
import { env } from '@/lib/env';
import {
  fetchPlanByType,
  grossCentsForNet,
  isFreeShippingActive,
  nextRenewalAt,
  SHIPPING_NET_CENTAVOS,
  type BillingCadence,
  type PlanType,
} from '@/lib/plans';

/**
 * Test-only seam: create a User + ACTIVE Subscription pair without
 * routing through Stripe. Lets the Step 13 admin-view spec populate the
 * registrations table with deterministic rows across both plan types
 * for filter testing.
 *
 * Idempotent: re-seeding the same email keeps the same User row, but
 * re-creates the Subscription so status / plan reflect the latest call.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(1024),
  fullName: z.string().min(1).max(255),
  phone: z.string().max(40).nullable().optional(),
  planType: z.enum(['ANGELA_ESENCIAL', 'ANGELA_TOTAL']),
  status: z
    .enum(['PENDING_PAYMENT', 'ACTIVE', 'PAST_DUE', 'CANCELLED'])
    .default('ACTIVE'),
  // Optional shippedAt stamp — when set, the seeded row lands in the
  // "Esperando activación" queue directly, skipping the mark-shipped
  // step. Used by activation-modal specs to seed a ready-to-pair row
  // without driving the prior UI step.
  shippedAtIso: z.string().datetime().optional(),
  // 2026-05-26 pricing pivot. When set, the Subscription row carries
  // the chosen cadence + a derived currentPeriodEnd so the dashboard
  // subscription card and the /admin/registrations cadence column have
  // realistic data to render.
  cadence: z.enum(['MONTHLY', 'SEMESTRAL', 'ANNUAL']).optional(),
  // Backdate the Subscription row so drip-email specs can simulate
  // "this PaymentIntent was created 25h ago" or "the device was
  // activated 8 days ago" without waiting. Drip-tick reads createdAt
  // for ABANDONED_CART and activatedAt for POST_PURCHASE_DAY7.
  createdAtIso: z.string().datetime().optional(),
  activatedAtIso: z.string().datetime().optional(),
});

export async function POST(request: NextRequest) {
  const secret = env.E2E_HOOKS_SECRET;
  if (!secret) return new NextResponse('not found', { status: 404 });
  const provided = request.headers.get('x-e2e-hook-secret');
  if (provided !== secret) return new NextResponse('not found', { status: 404 });

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
  if (!email) return NextResponse.json({ error: 'Invalid email' }, { status: 422 });

  const plan = await fetchPlanByType(parsed.data.planType as PlanType);
  if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });

  // Upsert User, then refresh Subscription for the requested plan/status.
  const passwordHash = hashPassword(parsed.data.password);
  const existing = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "User" WHERE LOWER(email) = ${email} LIMIT 1
  `;

  let userId: string;
  if (existing[0]) {
    userId = existing[0].id;
    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        fullName: parsed.data.fullName,
        phone: parsed.data.phone ?? null,
        isActive: true,
        questionnaireCompleted: true,
      },
    });
  } else {
    const created = await prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName: parsed.data.fullName,
        phone: parsed.data.phone ?? null,
        isActive: true,
        questionnaireCompleted: true,
      },
      select: { id: true },
    });
    userId = created.id;
  }

  // Drop any prior subscription for this user — keep one active row per
  // seed call so the admin filter test is deterministic.
  await prisma.subscription.deleteMany({ where: { userId } });

  const now = new Date();
  const cadence = (parsed.data.cadence ?? null) as BillingCadence | null;
  const renewalAt =
    parsed.data.status === 'ACTIVE' && cadence
      ? nextRenewalAt(now, cadence)
      : null;

  // Cadence-aware seeds mirror what /api/checkout/start computes so the
  // payment-confirmation email reads the same line-item shape it would
  // see on a real Stripe-confirmed flow. Plans without cadence pricing
  // configured fall back to the legacy single-monthly amount.
  const cadenceNetForPlan = (() => {
    if (!cadence) return null;
    if (cadence === 'MONTHLY') return plan.priceMonthlyCents;
    if (cadence === 'SEMESTRAL') return plan.priceSemestralCents;
    return plan.priceAnnualCents;
  })();
  const useCadenceTotals =
    cadence !== null &&
    cadenceNetForPlan !== null &&
    plan.initialFeeCents !== null;
  const initialFeeGross = useCadenceTotals
    ? grossCentsForNet(plan.initialFeeCents!)
    : 0;
  // Mirror the production Envío gate so seeded totals match what
  // /api/checkout/start actually charges Stripe.
  const freeShippingActive = isFreeShippingActive(
    Date.now(),
    env.NUCLEUS_FREE_SHIPPING_UNTIL_ISO,
  );
  const shippingGross =
    useCadenceTotals && !freeShippingActive
      ? grossCentsForNet(SHIPPING_NET_CENTAVOS)
      : 0;
  const recurringGross = useCadenceTotals
    ? grossCentsForNet(cadenceNetForPlan!)
    : grossCentsForNet(plan.monthlyPriceCents);
  const amountPaidCentavos = useCadenceTotals
    ? initialFeeGross + shippingGross + recurringGross
    : plan.monthlyPriceCents;

  const subscription = await prisma.subscription.create({
    data: {
      userId,
      planId: plan.id,
      status: parsed.data.status,
      purchaseType: 'SUBSCRIPTION',
      amountPaidCentavos,
      ...(cadence ? { cadence } : {}),
      ...(useCadenceTotals
        ? { initialFeePaidCentavos: initialFeeGross + shippingGross }
        : {}),
      ...(parsed.data.status === 'ACTIVE'
        ? {
            startDate: now,
            purchaseDate: now,
            currentPhase: 1,
            ...(renewalAt ? { currentPeriodEnd: renewalAt } : {}),
          }
        : {}),
      ...(parsed.data.shippedAtIso
        ? { shippedAt: new Date(parsed.data.shippedAtIso) }
        : {}),
      ...(parsed.data.createdAtIso
        ? { createdAt: new Date(parsed.data.createdAtIso) }
        : {}),
      ...(parsed.data.activatedAtIso
        ? { activatedAt: new Date(parsed.data.activatedAtIso) }
        : {}),
    },
    select: { id: true },
  });

  return NextResponse.json({
    ok: true,
    userId,
    subscriptionId: subscription.id,
    planType: plan.type,
  });
}
