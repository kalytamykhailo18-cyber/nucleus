import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireFamilyApiAuth } from '@/lib/admin';
import { dispatchAlertPush } from '@/lib/push-dispatch';

/**
 * App-side SOS dispatch (2026-06-24).
 *
 * Closes the long-standing Phase A gap where the mobile SOS button
 * only dialed a phone number and never notified the call-center
 * operator board. The mobile app now POSTs here in parallel with
 * the `tel:` open, so the dispatcher sees a real EviewEvent row on
 * `/admin/operator` the moment the senior or a family member taps
 * the panic button — even if the cell call doesn't connect.
 *
 * Authorisation: the caller must (a) be authenticated as a Family
 * Account and (b) own a `UserDevice` row pairing them to this
 * device (MASTER or WATCHER). Returns 401 / 403 / 404 otherwise.
 *
 * Idempotency: a fresh row is written every press — even within
 * seconds — so a frantic double-tap surfaces as two events on the
 * board. The cross-writer dedup that collapses TS-worker / Python-
 * subscriber duplicates does not key on app-side rows because they
 * carry a different `buttonType` marker.
 */
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  batteryLevel: z.number().int().min(0).max(100).nullable().optional(),
});

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ deviceId: string }> },
): Promise<NextResponse> {
  const gate = await requireFamilyApiAuth();
  if (!gate.ok) {
    return NextResponse.json(gate.body, { status: gate.status });
  }

  const { deviceId } = await ctx.params;
  if (!deviceId || typeof deviceId !== 'string' || deviceId.length > 64) {
    return NextResponse.json({ error: 'invalid_device' }, { status: 400 });
  }

  let raw: unknown = {};
  try {
    raw = (await request.json()) ?? {};
  } catch {
    raw = {};
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 422 });
  }

  // Ownership check — the caller must be paired to the device (any
  // role). Rejecting here keeps a malicious client from ringing the
  // dispatcher with somebody else's deviceId.
  const pairing = await prisma.userDevice.findFirst({
    where: { userId: gate.userId, eviewDeviceId: deviceId },
    select: { role: true },
  });
  if (!pairing) {
    return NextResponse.json({ error: 'not_paired' }, { status: 404 });
  }

  // Upsert the Device row so a freshly-paired pendant never breaks the
  // FK during its first app-side press (mirrors the seed-alert hook).
  await prisma.device.upsert({
    where: { deviceId },
    create: { deviceId, deviceType: 'PENDANT', isActive: true },
    update: {},
  });

  const now = new Date();
  const event = await prisma.eviewEvent.create({
    data: {
      eviewDeviceId: deviceId,
      eventType: 'sos',
      timestamp: now,
      // Marker so the operator board and downstream analytics can tell
      // an app-button press from a physical pendant SOS.
      buttonType: 'App SOS',
      batteryLevel: parsed.data.batteryLevel ?? null,
      lat: parsed.data.lat ?? null,
      lng: parsed.data.lng ?? null,
      processedAt: now,
    },
    select: { id: true },
  });

  const pushAttempts = await dispatchAlertPush(deviceId, {
    type: 'sos',
    deviceId,
    eventId: event.id,
    timestamp: now.toISOString(),
  });

  return NextResponse.json({
    ok: true,
    eventId: event.id,
    pushAttempts,
  });
}
