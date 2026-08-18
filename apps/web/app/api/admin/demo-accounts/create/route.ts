import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireSalesOrAdmin } from '@/lib/admin';
import { normalizeEmail } from '@/lib/email';
import { fetchPlanByType, type PlanType } from '@/lib/plans';
import { sendWelcomeDemoEmail } from '@/lib/emails/welcome-demo';

/**
 * Admin endpoint behind /admin/registrations. POST with the demo
 * lead's email, name, and chosen plan. We create (or reuse) the User
 * row and mint a $0 ACTIVE Subscription so the admin can assign a
 * device through the standard Asignar IMEI flow — same shape as a
 * paying customer minus the Stripe leg.
 *
 * Juan 2026-06-22: replaces the manual SQL insert the admin used to
 * have me run whenever a possible client needed a demo. The demo row
 * lives twelve months out so the renewal worker leaves it alone, and
 * carries amountPaidCentavos = 0 so financial reporting filters
 * skip it automatically.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  email: z.string().email().min(3).max(255),
  fullName: z.string().min(1).max(255),
  phone: z.string().max(40).nullable().optional(),
  planType: z.enum(['ANGELA_ESENCIAL', 'ANGELA_TOTAL']),
  // Juan 2026-06-25: same endpoint now backs the bank-transfer-paid
  // flow. Default '$0' demo (free trial). When `paymentMode` is
  // 'transfer', the subscription carries the real amount the customer
  // wired so accounting reports match. `paymentReference` lets the
  // admin record the bank reference number for reconciliation.
  paymentMode: z.enum(['demo', 'transfer']).optional(),
  amountPaidCentavos: z
    .number()
    .int()
    .min(0)
    .max(10_000_000)
    .nullable()
    .optional(),
  paymentReference: z.string().max(120).nullable().optional(),
});

export async function POST(request: NextRequest) {
  // 2026-06-30 (Juan): the sales team self-serves demo creation now
  // — same flow they're already doing via /admin/assisted-sales for
  // Stripe payment links. requireSalesOrAdmin keeps ADMIN behavior
  // identical while letting SALES role rows mint demos directly.
  await requireSalesOrAdmin();

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'validation failed',
        message: parsed.error.issues[0]?.message ?? 'invalid input',
      },
      { status: 422 },
    );
  }

  const email = normalizeEmail(parsed.data.email);
  if (!email) {
    return NextResponse.json({ error: 'invalid email' }, { status: 422 });
  }

  const plan = await fetchPlanByType(parsed.data.planType as PlanType);
  if (!plan) {
    return NextResponse.json({ error: 'plan not found' }, { status: 404 });
  }

  const paymentMode = parsed.data.paymentMode ?? 'demo';
  const requestedAmount = parsed.data.amountPaidCentavos ?? 0;
  // Transfer-paid rows MUST carry a positive amount, otherwise it is
  // indistinguishable from a free demo. Reject so the admin can fix
  // the input instead of silently shipping a $0 "transfer".
  if (paymentMode === 'transfer' && requestedAmount <= 0) {
    return NextResponse.json(
      { error: 'transfer_requires_amount', message: 'Transfer accounts require a positive amount.' },
      { status: 422 },
    );
  }
  const amountPaidCentavos = paymentMode === 'transfer' ? requestedAmount : 0;
  // Stash the bank reference (when present) into signupSource so it
  // surfaces in the CSV export + admin segment filter without a
  // schema change. Subscription has no `notes` column today.
  const trimmedRef = parsed.data.paymentReference?.trim();
  const signupSource =
    paymentMode === 'transfer'
      ? trimmedRef
        ? `transfer:${trimmedRef}`
        : 'transfer'
      : 'demo-account';

  // Reuse existing User row when the email already lives in the
  // system (admin may have hit Crear cuenta first). Otherwise mint a
  // FAMILY-kind row with no passwordHash — the admin can hand the
  // customer a /reset-password link later if they want app access.
  const existing = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "User" WHERE LOWER(email) = ${email} LIMIT 1
  `;
  const userId =
    existing[0]?.id ??
    (
      await prisma.user.create({
        data: {
          email,
          fullName: parsed.data.fullName,
          phone: parsed.data.phone ?? null,
          isActive: true,
          questionnaireCompleted: false,
          signupSource,
        },
        select: { id: true },
      })
    ).id;

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 12);

  // Idempotent on subscription too: if this user already has an
  // ACTIVE subscription of the same shape (demo $0 or transfer with
  // the requested amount), reuse it instead of stacking duplicates.
  // Lets the admin re-trigger the welcome email by clicking the
  // button again on an email that already has a matching row.
  const existingSub = await prisma.subscription.findFirst({
    where: {
      userId,
      status: 'ACTIVE',
      amountPaidCentavos,
    },
    select: { id: true },
  });
  const subData: Prisma.SubscriptionUncheckedCreateInput = {
    userId,
    planId: plan.id,
    status: 'ACTIVE',
    purchaseType: 'SUBSCRIPTION',
    amountPaidCentavos,
    cadence: 'MONTHLY',
    startDate: now,
    purchaseDate: now,
    currentPhase: 1,
    currentPeriodEnd: periodEnd,
  };
  const sub =
    existingSub ??
    (await prisma.subscription.create({
      data: subData,
      select: { id: true },
    }));

  // Juan 2026-06-23: drop the lead a welcome email with a one-time
  // /reset-password link so they pick a password, log in, and get
  // auto-bounced into the medical questionnaire by /dashboard. Fire
  // and forget — a Resend hiccup must not fail the demo-create call.
  void sendWelcomeDemoEmail({
    userId,
    email,
    fullName: parsed.data.fullName,
  });

  return NextResponse.json({
    ok: true,
    userId,
    subscriptionId: sub.id,
  });
}
