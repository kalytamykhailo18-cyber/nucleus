import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { ALERT_EVENT_TYPES, type AlertEventType } from '@/lib/alerts';
import { dispatchAlertPush } from '@/lib/push-dispatch';

/**
 * Test-only seam: insert a single EviewEvent row that will surface in the
 * alert feed. Lets the seed script + Playwright build deterministic alert
 * fixtures without round-tripping through the MQTT worker.
 *
 * Idempotent: if an event with the same (deviceId, eventType, timestamp)
 * already exists, it returns that row instead of creating a duplicate.
 * Idempotency lets us re-seed cleanly across redeploys.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  deviceId: z.string().min(1).max(64),
  eventType: z.enum(ALERT_EVENT_TYPES as unknown as [AlertEventType, ...AlertEventType[]]),
  minutesAgo: z.number().int().min(0).max(525_600).default(5),
  buttonType: z.string().max(64).nullable().optional(),
  batteryLevel: z.number().int().min(0).max(100).nullable().optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  // When true, the seed also fans out a web push to every subscribed
  // user that owns this device — same path the worker takes in production.
  // The seed-e2e baseline leaves this off; the Step 9 spec turns it on.
  dispatchPush: z.boolean().optional(),
  // Bypass the ±1s idempotency window to deliberately create a cross-
  // writer duplicate — used by the operator-board dedup spec to prove
  // the DISTINCT ON collapse works.
  forceDuplicate: z.boolean().optional(),
  // Explicit timestamp override (millis since epoch). When omitted, the
  // timestamp is computed from `minutesAgo` at the moment the seam is
  // hit — which means two calls in quick succession land milliseconds
  // apart. The dedup contract keys on (deviceId, eventType, timestamp),
  // so reproducing a real cross-writer race requires BOTH rows to
  // share an identical timestamp; that's what this override is for.
  timestampMs: z.number().int().positive().optional(),
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
      { error: 'Validation failed', message: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 422 },
    );
  }

  const { deviceId, eventType, minutesAgo, buttonType, batteryLevel, lat, lng, dispatchPush, forceDuplicate, timestampMs } = parsed.data;
  const ts = timestampMs !== undefined
    ? new Date(timestampMs)
    : new Date(Date.now() - minutesAgo * 60_000);

  // Upsert the device row so a hand-seeded eventType doesn't fail FK on a
  // demo device that hasn't received MQTT traffic yet.
  await prisma.device.upsert({
    where: { deviceId },
    create: { deviceId, deviceType: 'PENDANT', isActive: true },
    update: {},
  });

  // Idempotency: same (deviceId, eventType, timestamp ±1s) is treated as
  // the same logical seed call — unless forceDuplicate=true, in which
  // case we intentionally write a parallel row to exercise the operator-
  // board cross-writer dedup.
  const existing = forceDuplicate
    ? null
    : await prisma.eviewEvent.findFirst({
        where: {
          eviewDeviceId: deviceId,
          eventType,
          timestamp: {
            gte: new Date(ts.getTime() - 1_000),
            lte: new Date(ts.getTime() + 1_000),
          },
        },
        select: { id: true },
      });

  let eventId: string;
  let reused: boolean;

  if (existing) {
    // Re-seed wipes any prior read state so the spec always starts unread.
    await prisma.alertRead.deleteMany({ where: { eviewEventId: existing.id } });
    eventId = existing.id;
    reused = true;
  } else {
    const created = await prisma.eviewEvent.create({
      data: {
        eviewDeviceId: deviceId,
        eventType,
        timestamp: ts,
        buttonType: buttonType ?? null,
        batteryLevel: batteryLevel ?? null,
        lat: lat ?? null,
        lng: lng ?? null,
        processedAt: new Date(),
      },
      select: { id: true },
    });
    eventId = created.id;
    reused = false;
  }

  let pushAttempts = 0;
  if (dispatchPush) {
    pushAttempts = await dispatchAlertPush(deviceId, {
      type: eventType,
      deviceId,
      eventId,
      timestamp: ts.toISOString(),
    });
  }

  return NextResponse.json({ ok: true, eventId, reused, pushAttempts });
}
