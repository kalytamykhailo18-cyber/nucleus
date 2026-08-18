import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/admin';
import { logAdminAction } from '@/lib/admin-audit';

/**
 * POST /api/admin/subscriptions/[id]/pause
 *
 * Flips an ACTIVE subscription to PAUSED. Use case: family asks for a
 * vacation hold, hospitalization break, or simply pauses while they
 * decide whether to keep the service. The pendant and the dashboard
 * keep working; only the next billing cycle is skipped. An admin
 * un-pauses via /resume to flip back to ACTIVE.
 *
 * Reason is required so the audit log carries why the hold was set.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  reason: z.string().min(1).max(500),
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
  if (sub.status !== 'ACTIVE') {
    return NextResponse.json(
      { error: 'invalid_state', message: `Cannot pause a ${sub.status} subscription` },
      { status: 409 },
    );
  }

  await prisma.subscription.update({
    where: { id },
    data: { status: 'PAUSED' },
  });

  void logAdminAction({
    actorUserId: admin.id,
    actorEmail: admin.email,
    action: 'subscription.pause',
    targetType: 'Subscription',
    targetId: sub.id,
    metadata: {
      reason: parsed.data.reason,
      previousStatus: sub.status,
      customerEmail: sub.user.email,
    },
  });

  return NextResponse.json({ ok: true, status: 'PAUSED' });
}
