import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { dispatchSilentAck } from '@/lib/push-dispatch';

/**
 * Operator acknowledgement (Step 6). Called from the "Reconocer"
 * action on the operator notification and from the operator board.
 * Writes an idempotent OperatorAction row (kind=NOTED, note="Ya vi
 * la alerta") and fans a silent-ack push to every OTHER on-shift
 * operator subscription so their notification closes without them
 * duplicating effort. Family banners are deliberately NOT dismissed
 * — an operator being aware is not the same as the family being
 * aware.
 *
 * Idempotency: if this operator already recorded a NOTED "Ya vi"
 * on this event we return the existing row's id + createdAt without
 * writing a duplicate. Any other kind of prior action still logs a
 * new NOTED row so the audit trail preserves the full timeline.
 */
export const dynamic = 'force-dynamic';

const NOTED_ACK_NOTE = 'Ya vi la alerta';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const role =
    (session?.user as { role?: string } | undefined)?.role ?? 'USER';
  if (role !== 'CALLCENTER' && role !== 'ADMIN') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { id: alertId } = await params;
  const event = await prisma.eviewEvent.findUnique({
    where: { id: alertId },
    select: { id: true, eviewDeviceId: true },
  });
  if (!event) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const existing = await prisma.operatorAction.findFirst({
    where: {
      eviewEventId: alertId,
      operatorUserId: userId,
      kind: 'NOTED',
      note: NOTED_ACK_NOTE,
    },
    select: { id: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  const row =
    existing ??
    (await prisma.operatorAction.create({
      data: {
        eviewEventId: alertId,
        operatorUserId: userId,
        kind: 'NOTED',
        note: NOTED_ACK_NOTE,
      },
      select: { id: true, createdAt: true },
    }));

  const fanned = await dispatchSilentAck({
    alertId,
    deviceId: event.eviewDeviceId,
    ackSource: 'operator',
  });

  return NextResponse.json({
    ok: true,
    actionId: row.id,
    createdAt: row.createdAt.toISOString(),
    silentAcksFanned: fanned,
    duplicate: Boolean(existing),
  });
}
