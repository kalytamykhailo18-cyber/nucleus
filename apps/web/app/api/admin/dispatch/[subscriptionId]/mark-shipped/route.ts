import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/admin';
import { logAdminAction } from '@/lib/admin-audit';
import { sendShipmentNotificationEmail } from '@/lib/emails/shipment-notification';

/**
 * Call-center action: stamp `shippedAt` on a Subscription and fire the
 * shipment-notification email. Idempotent — calling twice doesn't send
 * the email twice (the `updateMany` count > 0 guard catches it).
 */
export const dynamic = 'force-dynamic';

export async function POST(
  _request: Request,
  context: { params: Promise<{ subscriptionId: string }> },
): Promise<NextResponse> {
  const admin = await requireAdmin();
  const { subscriptionId } = await context.params;
  const result = await prisma.subscription.updateMany({
    where: { id: subscriptionId, status: 'ACTIVE', shippedAt: null },
    data: { shippedAt: new Date(), shippedBy: admin.email },
  });
  if (result.count === 0) {
    return NextResponse.json(
      { error: 'not_actionable', message: 'No ACTIVE subscription found, or already shipped.' },
      { status: 409 },
    );
  }
  void sendShipmentNotificationEmail(subscriptionId);
  void logAdminAction({
    action: 'subscription.mark_shipped',
    targetType: 'Subscription',
    targetId: subscriptionId,
  });
  return NextResponse.json({ ok: true });
}
