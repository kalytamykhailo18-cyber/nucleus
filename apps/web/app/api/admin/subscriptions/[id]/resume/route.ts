import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/admin';
import { logAdminAction } from '@/lib/admin-audit';

/**
 * POST /api/admin/subscriptions/[id]/resume
 *
 * Counterpart to /pause — flips a PAUSED subscription back to ACTIVE
 * so the next renewal cycle fires normally. No Stripe call needed
 * (we use one-shot PaymentIntents per cycle, not Stripe Subscriptions,
 * so there is nothing to un-pause on Stripe's side). The next charge
 * fires via the existing renewal flow on `purchaseDate + cadence`.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  reason: z.string().min(1).max(500).optional(),
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
    select: { id: true, status: true, user: { select: { email: true } } },
  });
  if (!sub) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (sub.status !== 'PAUSED') {
    return NextResponse.json(
      { error: 'invalid_state', message: `Cannot resume a ${sub.status} subscription` },
      { status: 409 },
    );
  }

  await prisma.subscription.update({
    where: { id },
    data: { status: 'ACTIVE' },
  });

  void logAdminAction({
    actorUserId: admin.id,
    actorEmail: admin.email,
    action: 'subscription.resume',
    targetType: 'Subscription',
    targetId: sub.id,
    metadata: {
      reason: parsed.data.reason ?? null,
      previousStatus: sub.status,
      customerEmail: sub.user.email,
    },
  });

  return NextResponse.json({ ok: true, status: 'ACTIVE' });
}
