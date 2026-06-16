import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';

/**
 * Test-only seam: plant a single geofence directly (no session auth).
 * The production `/api/geofences` POST goes through `requireAuth()` and
 * runs the zone-limit / ownership checks; this seam bypasses them so
 * `seed-e2e.sh` can populate fixtures without minting a session cookie.
 *
 * Idempotent at the (userEmail, deviceId, name) level — re-seeding the
 * same row replaces it instead of stacking duplicates.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  userEmail: z.string().email(),
  deviceId: z.string().min(1).max(64),
  name: z.string().min(1).max(80),
  centerLat: z.number().min(-90).max(90),
  centerLng: z.number().min(-180).max(180),
  radiusMeters: z.number().int().min(20).max(50_000),
  direction: z.enum(['ENTER', 'LEAVE', 'BOTH']).default('BOTH'),
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
    return NextResponse.json({ error: 'Validation failed' }, { status: 422 });
  }
  const { userEmail, deviceId, name, centerLat, centerLng, radiusMeters, direction } = parsed.data;

  const userRows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "User" WHERE LOWER(email) = ${userEmail.toLowerCase()} LIMIT 1
  `;
  const user = userRows[0];
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  // Replace any prior geofence with the same (deviceId, name) for the user
  // so the seed call is idempotent.
  await prisma.geofence.deleteMany({
    where: { userId: user.id, eviewDeviceId: deviceId, name },
  });

  // Find the next free zoneNumber 1..4 for this device.
  const taken = await prisma.geofence.findMany({
    where: { eviewDeviceId: deviceId },
    select: { zoneNumber: true },
  });
  const used = new Set(taken.map((g) => g.zoneNumber));
  let zoneNumber = -1;
  for (let i = 1; i <= 4; i += 1) {
    if (!used.has(i)) { zoneNumber = i; break; }
  }
  if (zoneNumber === -1) {
    return NextResponse.json(
      { error: 'Zone limit reached', message: 'device has 4 active zones already' },
      { status: 409 },
    );
  }

  const created = await prisma.geofence.create({
    data: {
      userId: user.id,
      eviewDeviceId: deviceId,
      zoneNumber,
      name,
      centerLat,
      centerLng,
      radiusMeters,
      direction,
    },
    select: { id: true, zoneNumber: true },
  });

  return NextResponse.json({ ok: true, ...created });
}
