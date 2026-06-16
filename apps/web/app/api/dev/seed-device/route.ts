import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';

/**
 * Test-only seam: assign a Device to a User by email, optionally with a
 * latest EviewEvent so the dashboard's battery + last-seen fields have
 * something to display. Gated by E2E_HOOKS_SECRET.
 *
 * The endpoint is idempotent — calling twice with the same userEmail +
 * deviceId updates the existing UserDevice row instead of erroring on the
 * unique constraint, which keeps re-running tests safe.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  userEmail: z.string().email(),
  deviceId: z.string().min(1).max(64),
  label: z.string().max(64).nullable().optional(),
  isPrimary: z.boolean().optional(),
  batteryLevel: z.number().int().min(0).max(100).nullable().optional(),
  lastSeenMinutesAgo: z.number().int().min(0).max(525_600).nullable().optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
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
      {
        error: 'Validation failed',
        message: parsed.error.issues[0]?.message ?? 'Invalid input',
      },
      { status: 422 },
    );
  }

  const {
    userEmail,
    deviceId,
    label,
    isPrimary,
    batteryLevel,
    lastSeenMinutesAgo,
    lat,
    lng,
  } = parsed.data;

  // Look up the user (case-insensitive, same as auth).
  const userRows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "User" WHERE LOWER(email) = ${userEmail.toLowerCase()} LIMIT 1
  `;
  const user = userRows[0];
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Upsert the Device.
  await prisma.device.upsert({
    where: { deviceId },
    create: {
      deviceId,
      deviceType: 'PENDANT',
      isActive: true,
    },
    update: {},
  });

  // Upsert the UserDevice (idempotent re-seed).
  await prisma.userDevice.upsert({
    where: {
      userId_eviewDeviceId: { userId: user.id, eviewDeviceId: deviceId },
    },
    create: {
      userId: user.id,
      eviewDeviceId: deviceId,
      label: label ?? null,
      isPrimary: isPrimary ?? false,
    },
    update: {
      label: label ?? null,
      isPrimary: isPrimary ?? false,
    },
  });

  // Record telemetry if any was supplied.
  const hasBattery = batteryLevel !== undefined && batteryLevel !== null;
  const hasLastSeen = lastSeenMinutesAgo !== undefined && lastSeenMinutesAgo !== null;
  const hasFix = lat != null && lng != null;
  if (hasBattery || hasLastSeen || hasFix) {
    const minutesAgo = lastSeenMinutesAgo ?? 0;
    const ts = new Date(Date.now() - minutesAgo * 60_000);
    await prisma.eviewEvent.create({
      data: {
        eviewDeviceId: deviceId,
        eventType: 'heartbeat',
        timestamp: ts,
        batteryLevel: batteryLevel ?? null,
        lat: hasFix ? lat : null,
        lng: hasFix ? lng : null,
        processedAt: new Date(),
      },
    });
  }

  return NextResponse.json({ ok: true, userId: user.id, deviceId });
}
