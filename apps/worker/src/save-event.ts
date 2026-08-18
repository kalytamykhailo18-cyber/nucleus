/**
 * Persist a classified Eview event to Postgres with the same row shape as
 * the Python subscriber writes. Read `sensu-api/core/database.py
 * EviewEventManager.save_event` if you want to verify column-by-column.
 *
 * Two safety rails carry over from Python:
 *
 *   1. Per-(device, eventType) advisory lock around the dedup-then-insert,
 *      so two near-simultaneous trackerAlarm messages don't both pass the
 *      dedup check. Race window without the lock is ~5 ms but real.
 *
 *   2. 180-second dedup window keyed on (deviceId, eventType, statusCode).
 *      Devices retransmit alarms while the call is open. We don't want a
 *      single SOS press to stack four rows in the feed.
 *
 * The Device row is upserted on first sight — production-flow equivalent
 * runs before the device ships, but tests need it to be idempotent.
 */

import type { Prisma, PrismaClient } from '@prisma/client';
import { parseButtonType } from './alarm';
import { recordParityCheck } from './parity';

// 180s dedup window — raised from 60s on 2026-06-16 after Juan's live
// SOS test (2026-05-22) showed Eview retransmitting the same alarm
// 2–3 minutes apart on EV-12 hardware. DB scan confirmed: 5 duplicates
// landed in the 60–180s band over 30 days. Beyond 180s we treat the
// alarm as a legitimate second press, not a retransmit.
const DEDUP_WINDOW_SECONDS = 180;
const INT32_MAX = 0x7fffffff;

/**
 * Mirror Python's `hash((device_id, event_type)) & 0x7FFFFFFF`. Python's
 * tuple hash is non-deterministic across runs (PYTHONHASHSEED) but stable
 * within a process — identical to our needs here. We use a fast FNV-1a
 * over the two strings to get a deterministic 31-bit positive int.
 */
function advisoryLockKey(deviceId: string, eventType: string): number {
  const input = `${deviceId}:${eventType}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash & INT32_MAX;
}

export interface SaveEventInput {
  deviceId: string;
  eventType: string;
  timestamp: Date;
  buttonType: string | null;
  payload: Record<string, unknown>;
}

export interface SaveEventResult {
  /** newly inserted EviewEvent.id, or null when deduped */
  id: string | null;
}

interface NormalizedFields {
  deviceName: string | null;
  batteryLevel: number | null;
  lat: number | null;
  lng: number | null;
  accuracyMeters: number | null;
  isGps: boolean;
  isWifi: boolean;
  isGsm: boolean;
  isMotion: boolean;
  isCharging: boolean;
  workMode: number | null;
  signalStrength: number | null;
  statusCode: number | null;
  statusCode2: number | null;
  alarmCode: number | null;
  alarmCodeExtend: number | null;
  buttonType: string | null;
}

function normalize(payload: Record<string, unknown>, providedButtonType: string | null): NormalizedFields {
  const data = (payload.data as Record<string, unknown> | undefined) ?? {};
  const generalData = (data.generalData as Record<string, unknown> | undefined) ?? {};
  let locationData = (data.latestLocation as Record<string, unknown> | undefined) ?? {};
  const headers = (payload.headers as Record<string, unknown> | undefined) ?? {};

  // Simplified alarm payloads put lat/lng directly under data — fall back
  // when latestLocation is missing.
  if (locationData.lat == null && data.lat != null) {
    locationData = data;
  }

  const statusCode = (generalData.statusCode as number | undefined) ?? null;
  const alarmCode = (generalData.alarmCode as number | undefined) ?? null;

  return {
    deviceName: (headers.deviceName as string | undefined) ?? null,
    batteryLevel: (generalData.battery as number | undefined) ?? null,
    lat: (locationData.lat as number | undefined) ?? null,
    lng: (locationData.lng as number | undefined) ?? null,
    accuracyMeters: (locationData.radius as number | undefined) ?? null,
    isGps: Boolean(generalData.isGPS ?? false),
    isWifi: Boolean(generalData.isWIFI ?? false),
    isGsm: Boolean(generalData.isGSM ?? false),
    isMotion: Boolean(generalData.isMotion ?? false),
    isCharging: Boolean(generalData.isCharging ?? false),
    workMode: (generalData.workMode as number | undefined) ?? null,
    signalStrength: (generalData.signalSize as number | undefined) ?? null,
    statusCode,
    statusCode2: (generalData.statusCode2 as number | undefined) ?? null,
    alarmCode,
    alarmCodeExtend: (generalData.alarmCodeExtend as number | undefined) ?? null,
    buttonType: providedButtonType ?? parseButtonType(statusCode),
  };
}

export async function saveEviewEvent(
  prisma: PrismaClient,
  input: SaveEventInput,
): Promise<SaveEventResult> {
  const fields = normalize(input.payload, input.buttonType);
  const cutoff = new Date(Date.now() - DEDUP_WINDOW_SECONDS * 1000);
  const lockKey = advisoryLockKey(input.deviceId, input.eventType);

  const result = await prisma.$transaction(async (tx) => {
    // Idempotent device-row upsert keyed on the unique deviceId.
    await tx.device.upsert({
      where: { deviceId: input.deviceId },
      create: { deviceId: input.deviceId, deviceType: 'PENDANT' },
      update: {},
    });

    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${lockKey})`);

    // Dedup: same device + eventType + statusCode within the window.
    const existing = await tx.eviewEvent.findFirst({
      where: {
        eviewDeviceId: input.deviceId,
        eventType: input.eventType,
        statusCode: fields.statusCode,
        createdAt: { gt: cutoff },
      },
      select: { id: true },
    });

    if (existing) {
      return { id: null } satisfies SaveEventResult;
    }

    const created = await tx.eviewEvent.create({
      data: {
        eviewDeviceId: input.deviceId,
        eventType: input.eventType,
        timestamp: input.timestamp,
        deviceName: fields.deviceName,
        batteryLevel: fields.batteryLevel,
        lat: fields.lat,
        lng: fields.lng,
        accuracyMeters: fields.accuracyMeters,
        isGps: fields.isGps,
        isWifi: fields.isWifi,
        isGsm: fields.isGsm,
        isMotion: fields.isMotion,
        isCharging: fields.isCharging,
        workMode: fields.workMode,
        signalStrength: fields.signalStrength,
        statusCode: fields.statusCode,
        statusCode2: fields.statusCode2,
        alarmCode: fields.alarmCode,
        alarmCodeExtend: fields.alarmCodeExtend,
        buttonType: fields.buttonType,
        rawPayload: input.payload as Prisma.InputJsonValue,
      },
      select: { id: true },
    });

    return { id: created.id } satisfies SaveEventResult;
  });

  // Step 14 parity log — best-effort, never blocks the event pipeline.
  // Parity rows represent OBSERVATIONS, not saves: this subscriber saw
  // the event regardless of whether the EviewEvent insert was deduped
  // against a row the other subscriber wrote first. Writing parity
  // unconditionally is what lets the 7-day comparator find a matching
  // pair when TS and PYTHON both see the same physical MQTT message.
  try {
    await recordParityCheck(prisma, 'TS', {
      eviewDeviceId: input.deviceId,
      eventType: input.eventType,
      timestamp: input.timestamp,
      statusCode: fields.statusCode,
      alarmCode: fields.alarmCode,
      batteryLevel: fields.batteryLevel,
      lat: fields.lat,
      lng: fields.lng,
      eviewEventId: result.id,
    });
  } catch (err) {
    // Don't crash the worker if parity logging fails — the canonical
    // event already saved; parity is observability, not correctness.
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: 'warn',
        msg: 'parity log failed',
        deviceId: input.deviceId,
        eventType: input.eventType,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }

  return result;
}
