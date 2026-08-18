import { NextResponse } from 'next/server';
import { requireFamilyApiAuth } from '@/lib/admin';
import { prisma } from '@/lib/db';
import { dispatchSilentAck } from '@/lib/push-dispatch';

/**
 * Family acknowledgement (Step 6). Called from the "Ya vi" action on
 * the notification and from the in-app active-alert banner. Writes
 * an idempotent AlertRead row and fans a silent-ack push to every
 * OTHER family subscription on the same device so their notifications
 * close and their active-alert banner clears without a manual refresh.
 *
 * Idempotency: if the row already exists it is not rewritten, so the
 * timestamp of the first ack survives duplicate taps. Response is
 * always 200 on a successful ownership check; the caller cannot tell
 * whether this is the first ack or the third.
 *
 * Source tracking: the notification-tap path sends
 * `?source=notification`, which stamps `dismissedFromNotificationAt`
 * for analytics. The in-app path omits it.
 */
export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const gate = await requireFamilyApiAuth();
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });
  const userId = gate.userId;
  const { id: alertId } = await params;

  const event = await prisma.eviewEvent.findUnique({
    where: { id: alertId },
    select: { id: true, eviewDeviceId: true },
  });
  if (!event) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const owns = await prisma.userDevice.findFirst({
    where: { userId, eviewDeviceId: event.eviewDeviceId },
    select: { id: true },
  });
  if (!owns) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const url = new URL(request.url);
  const fromNotification = url.searchParams.get('source') === 'notification';
  const now = new Date();

  const row = await prisma.alertRead.upsert({
    where: { userId_eviewEventId: { userId, eviewEventId: alertId } },
    create: {
      userId,
      eviewEventId: alertId,
      dismissedFromNotificationAt: fromNotification ? now : null,
    },
    update: fromNotification
      ? { dismissedFromNotificationAt: { set: now } }
      : {},
    select: { readAt: true, dismissedFromNotificationAt: true },
  });

  const fanned = await dispatchSilentAck({
    alertId,
    deviceId: event.eviewDeviceId,
    ackSource: 'family',
  });

  return NextResponse.json({
    ok: true,
    readAt: row.readAt.toISOString(),
    dismissedFromNotificationAt: row.dismissedFromNotificationAt?.toISOString() ?? null,
    silentAcksFanned: fanned,
  });
}
