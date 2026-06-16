import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { env } from '@/lib/env';
import { evaluateGeofenceBreach } from '@/lib/geofences';
import { dispatchAlertPush } from '@/lib/push-dispatch';

/**
 * Test-only seam: simulate an Eview location update arriving for a
 * device. Same code path the worker will run when it starts persisting
 * raw location events: compare the new lat/lng against every active
 * geofence, write enter/exit alerts on transitions, fan out push.
 *
 * Gated by E2E_HOOKS_SECRET. The Step 10 spec uses this to drive the
 * "device crosses a boundary → alert lands within 5 s" acceptance.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  deviceId: z.string().min(1).max(64),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
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

  const { deviceId, lat, lng } = parsed.data;
  const now = new Date();
  const result = await evaluateGeofenceBreach(deviceId, lat, lng, now);

  // Fan out a push for each transition event we emitted, mirroring what
  // the worker's `dispatchAlertPush` does for SOS / fall / battery.
  let pushAttempts = 0;
  for (const eventId of result.eventIds) {
    pushAttempts += await dispatchAlertPush(deviceId, {
      type: 'geofence',
      deviceId,
      eventId,
      timestamp: now.toISOString(),
    });
  }

  return NextResponse.json({
    ok: true,
    transitions: result.eventIds.length,
    eventIds: result.eventIds,
    pushAttempts,
  });
}
