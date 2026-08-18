import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/admin';
import { logAdminAction } from '@/lib/admin-audit';

/**
 * POST /api/admin/subscriptions/[id]/change-plan
 *
 * Swap a customer's plan type and/or billing cadence without forcing
 * them through a fresh checkout. The change applies on the NEXT
 * renewal — current cycle stays untouched so we never double-bill or
 * pro-rate mid-cycle. Common use cases:
 *
 *   - Family asks to drop from Total → Esencial after Cruz Roja
 *     reshape made Total less appealing.
 *   - Family wants to switch Monthly → Annual to lock the 12% Ahorra
 *     discount.
 *
 * No Stripe call here: the next renewal charge is created by the
 * existing checkout flow, which reads Plan.id + cadence at charge-
 * creation time. By updating those columns now we redirect the next
 * charge cleanly.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  planType: z.enum(['ANGELA_ESENCIAL', 'ANGELA_TOTAL']).optional(),
  cadence: z.enum(['MONTHLY', 'SEMESTRAL', 'ANNUAL']).optional(),
  reason: z.string().min(1).max(500),
}).refine((d) => d.planType !== undefined || d.cadence !== undefined, {
  message: 'Provide at least one of planType or cadence',
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const admin = await requireAdmin();
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid' }, { status: 422 });
  }

  const sub = await prisma.subscription.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      cadence: true,
      planId: true,
      plan: { select: { type: true, name: true } },
      user: { select: { email: true } },
    },
  });
  if (!sub) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (sub.status === 'CANCELLED') {
    return NextResponse.json(
      { error: 'invalid_state', message: 'Cannot change plan on a CANCELLED subscription' },
      { status: 409 },
    );
  }

  // Resolve the target plan id if planType changed.
  let nextPlanId = sub.planId;
  let nextPlanName = sub.plan.name;
  let nextPlanType = sub.plan.type;
  if (parsed.data.planType && parsed.data.planType !== sub.plan.type) {
    const plan = await prisma.plan.findUnique({
      where: { type: parsed.data.planType },
      select: { id: true, name: true, type: true },
    });
    if (!plan) {
      return NextResponse.json(
        { error: 'plan_not_found', message: `No Plan row for type ${parsed.data.planType}` },
        { status: 422 },
      );
    }
    nextPlanId = plan.id;
    nextPlanName = plan.name;
    nextPlanType = plan.type;
  }

  const nextCadence = parsed.data.cadence ?? sub.cadence;

  await prisma.subscription.update({
    where: { id },
    data: {
      planId: nextPlanId,
      cadence: nextCadence,
    },
  });

  void logAdminAction({
    actorUserId: admin.id,
    actorEmail: admin.email,
    action: 'subscription.change_plan',
    targetType: 'Subscription',
    targetId: sub.id,
    metadata: {
      reason: parsed.data.reason,
      from: { planType: sub.plan.type, cadence: sub.cadence },
      to: { planType: nextPlanType, cadence: nextCadence },
      customerEmail: sub.user.email,
    },
  });

  return NextResponse.json({
    ok: true,
    planType: nextPlanType,
    planName: nextPlanName,
    cadence: nextCadence,
  });
}
