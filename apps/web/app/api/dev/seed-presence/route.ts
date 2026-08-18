import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';

/**
 * Test-only seam (Phase B polish, 2026-06-10).
 *
 * Bumps an admin's `lastOperatorPingAt` to "now" AND creates a fresh
 * actionable EviewEvent that the same admin has just claimed via a
 * PHONED_AURA OperatorAction — i.e. the seeded admin shows up on
 * /admin/operator's presence panel with `load = 1` deterministically,
 * without driving the live 30-second heartbeat cadence from a browser.
 *
 * The seeded device + event use the lowercase `e2e-presence-` prefix
 * so they bypass the `eviewDeviceId NOT LIKE 'E2E-%'` filter that the
 * operator-board/presence queries apply for STEP6 / E2E worker noise
 * (those filters are uppercase-anchored).
 *
 * Idempotent: re-calling for the same admin email upserts the
 * heartbeat, finds-or-creates the device row, and inserts a fresh
 * event + action on each call. The spec asserts on `load >= 1` so
 * accumulation across re-runs is fine.
 *
 * Gated by `E2E_HOOKS_SECRET` like every other /api/dev/* endpoint.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  adminEmail: z.string().email(),
  /**
   * When true, backdate `lastOperatorPingAt` by 10 minutes so the admin
   * falls outside the 60 s "on shift" window. Lets the empty-state
   * spec observe the "Nadie en turno ahora" panel deterministically.
   * No event/action is created in this mode.
   */
  makeStale: z.boolean().optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = env.E2E_HOOKS_SECRET;
  if (!secret) {
    return new NextResponse('not found', { status: 404 });
  }
  const provided = request.headers.get('x-e2e-hook-secret');
  if (provided !== secret) {
    return new NextResponse('not found', { status: 404 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed' }, { status: 422 });
  }

  const admin = await prisma.user.findFirst({
    where: { email: parsed.data.adminEmail, role: 'ADMIN' },
    select: { id: true, email: true },
  });
  if (!admin) {
    return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
  }

  if (parsed.data.makeStale) {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1_000);
    // Backdate THIS admin AND every other ADMIN so the panel goes
    // empty (otherwise a second admin's recent heartbeat would still
    // populate it).
    await prisma.user.updateMany({
      where: { role: 'ADMIN' },
      data: { lastOperatorPingAt: tenMinutesAgo },
    });
    return NextResponse.json({ ok: true, adminId: admin.id, stale: true });
  }

  // Mark this admin as on shift.
  await prisma.user.update({
    where: { id: admin.id },
    data: { lastOperatorPingAt: new Date() },
  });

  // Find-or-create a deterministic test device per admin.
  const deviceId = `e2e-presence-device-${admin.id.slice(0, 8)}`;
  await prisma.device.upsert({
    where: { deviceId },
    create: {
      deviceId,
      deviceName: 'E2E presence test pendant',
      isActive: true,
    },
    update: {},
  });
  // The operator board suppresses "Sin titular asignado" rows (Juan
  // 2026-06-19) by requiring EXISTS a MASTER UserDevice on the
  // eviewDeviceId, so the seeded SOS needs a paired MASTER user.
  // Pair to a dedicated synthetic fixture, NOT the real admin —
  // otherwise the admin's /dashboard accumulates a presence-device row
  // and the userId-filter spec sees 2 devices instead of 1.
  const fixtureEmail = 'presence-fixture@nucleus-test.local';
  const fixture = await prisma.user.upsert({
    where: { email: fixtureEmail },
    create: {
      email: fixtureEmail,
      fullName: 'Presence Fixture',
      role: 'USER',
      isActive: false,
    },
    update: {},
    select: { id: true },
  });
  const existingPairing = await prisma.userDevice.findFirst({
    where: { eviewDeviceId: deviceId, role: 'MASTER' },
    select: { id: true, userId: true },
  });
  if (!existingPairing) {
    await prisma.userDevice.create({
      data: {
        userId: fixture.id,
        eviewDeviceId: deviceId,
        role: 'MASTER',
        isPrimary: true,
      },
    });
  } else if (existingPairing.userId === admin.id) {
    // Heal any legacy pairing that landed on the admin and now leaks
    // into the admin's /dashboard list.
    await prisma.userDevice.update({
      where: { id: existingPairing.id },
      data: { userId: fixture.id },
    });
  }

  // New event + claiming action. Fresh row per call so the latest
  // OperatorAction is always this PHONED_AURA — load counts it.
  // Includes a Mexico-City lat/lng so the same seed also populates a
  // marker on the operator-map overlay (Phase B Step B).
  const event = await prisma.eviewEvent.create({
    data: {
      eviewDeviceId: deviceId,
      eventType: 'sos',
      timestamp: new Date(),
      lat: 19.4326,
      lng: -99.1332,
    },
    select: { id: true },
  });
  await prisma.operatorAction.create({
    data: {
      eviewEventId: event.id,
      operatorUserId: admin.id,
      kind: 'PHONED_AURA',
    },
  });

  return NextResponse.json({
    ok: true,
    adminId: admin.id,
    deviceId,
    eventId: event.id,
  });
}
