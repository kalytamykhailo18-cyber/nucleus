import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/admin';
import { logAdminAction } from '@/lib/admin-audit';
import { sendDeviceActivatedEmail } from '@/lib/emails/device-activated';

/**
 * Call-center action: pair an Eview pendant (eviewDeviceId / IMEI) to
 * the Subscription's user as a MASTER UserDevice, stamp activatedAt,
 * and fire the device-activated email. The Device row is upserted so
 * the call-center can use a fresh IMEI not yet in our DB.
 *
 * Refuses to activate if (a) subscription isn't ACTIVE, (b) it was
 * already activated, or (c) the IMEI is already linked to a different
 * user as MASTER — a collision the operator must resolve before retry.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  eviewDeviceId: z.string().trim().min(8).max(64).regex(/^[A-Za-z0-9-]+$/),
  // Optional pendant phone number captured by the call-center at
  // activation time. Surfaces on the operator caller-ID modal as a
  // click-to-call tel: link (Juan 2026-05-25).
  phoneNumber: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^[+()\d\s-]+$/, 'Phone may contain digits, spaces, +, -, ( )')
    .optional()
    .nullable(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ subscriptionId: string }> },
): Promise<NextResponse> {
  const admin = await requireAdmin();
  const { subscriptionId } = await context.params;
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid', message: parsed.error.issues[0]?.message ?? 'Invalid IMEI' },
      { status: 422 },
    );
  }
  const eviewDeviceId = parsed.data.eviewDeviceId.toUpperCase();
  const phoneNumber = parsed.data.phoneNumber ?? null;

  const sub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: { id: true, userId: true, status: true, activatedAt: true },
  });
  if (!sub) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (sub.status !== 'ACTIVE') {
    return NextResponse.json(
      { error: 'not_active', message: 'Subscription must be ACTIVE before activation.' },
      { status: 409 },
    );
  }
  if (sub.activatedAt) {
    return NextResponse.json(
      { error: 'already_activated', message: 'Device already paired for this subscription.' },
      { status: 409 },
    );
  }

  // Collision check: IMEI already on another user as MASTER?
  const existingMaster = await prisma.userDevice.findFirst({
    where: { eviewDeviceId, role: 'MASTER', NOT: { userId: sub.userId } },
    select: { id: true, userId: true },
  });
  if (existingMaster) {
    return NextResponse.json(
      {
        error: 'imei_collision',
        message: `IMEI ${eviewDeviceId} is already paired to another account. Resolve first.`,
      },
      { status: 409 },
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.device.upsert({
        where: { deviceId: eviewDeviceId },
        create: {
          deviceId: eviewDeviceId,
          deviceType: 'PENDANT',
          isActive: true,
          phoneNumber,
        },
        // Only overwrite phoneNumber when one was supplied — otherwise
        // re-activating a paired-then-unpaired device would clear an
        // existing number the call-center already entered.
        update:
          phoneNumber !== null
            ? { isActive: true, phoneNumber }
            : { isActive: true },
      });
      await tx.userDevice.upsert({
        where: {
          userId_eviewDeviceId: { userId: sub.userId, eviewDeviceId },
        },
        create: {
          userId: sub.userId,
          eviewDeviceId,
          role: 'MASTER',
          isPrimary: true,
        },
        update: { role: 'MASTER', isPrimary: true },
      });
      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          activatedAt: new Date(),
          activatedBy: admin.email,
          activatedDeviceId: eviewDeviceId,
        },
      });
    });
  } catch (err) {
    console.error('activate-device transaction failed', err);
    return NextResponse.json({ error: 'tx_failed' }, { status: 500 });
  }

  void sendDeviceActivatedEmail(subscriptionId);
  void logAdminAction({
    action: 'subscription.activate_device',
    targetType: 'Subscription',
    targetId: subscriptionId,
    metadata: { eviewDeviceId },
  });
  return NextResponse.json({ ok: true, eviewDeviceId });
}
