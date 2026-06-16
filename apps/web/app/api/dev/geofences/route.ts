import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';

/**
 * Test-only seam: wipe every geofence on a given device. Lets seed-e2e.sh
 * keep the demo fixture deterministic — the spec walks through CRUD from
 * an empty state, so we wipe before each redeploy run.
 *
 * Gated by E2E_HOOKS_SECRET. No GET / POST here on purpose: real
 * geofence CRUD lives behind /api/geofences with full session auth.
 */
export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest) {
  const secret = env.E2E_HOOKS_SECRET;
  if (!secret) return new NextResponse('not found', { status: 404 });
  const provided = request.headers.get('x-e2e-hook-secret');
  if (provided !== secret) return new NextResponse('not found', { status: 404 });

  const deviceId = request.nextUrl.searchParams.get('deviceId');
  if (!deviceId) {
    return NextResponse.json({ error: 'missing ?deviceId=' }, { status: 400 });
  }

  const result = await prisma.geofence.deleteMany({
    where: { eviewDeviceId: deviceId },
  });
  return NextResponse.json({ ok: true, deleted: result.count });
}
