import type { PrismaClient } from '@prisma/client';

/**
 * Step 14 — record what the TS subscriber classified for every incoming
 * MQTT message, alongside the EviewEvent it produced (or null if the
 * save was deduped / failed). The /api/admin/parity endpoint then diffs
 * these rows against equivalent observations from the Python subscriber
 * during the 7-day parity window.
 *
 * Best-effort: a parity-write failure must never break the actual event
 * pipeline, so callers should swallow exceptions and log.
 */
export interface ParityObservation {
  eviewDeviceId: string;
  eventType: string;
  timestamp: Date;
  statusCode: number | null;
  alarmCode: number | null;
  batteryLevel: number | null;
  lat: number | null;
  lng: number | null;
  eviewEventId: string | null;
}

export async function recordParityCheck(
  prisma: PrismaClient,
  source: 'TS' | 'PYTHON',
  obs: ParityObservation,
): Promise<void> {
  await prisma.workerParityCheck.create({
    data: {
      source,
      eviewDeviceId: obs.eviewDeviceId,
      eventType: obs.eventType,
      timestamp: obs.timestamp,
      statusCode: obs.statusCode,
      alarmCode: obs.alarmCode,
      batteryLevel: obs.batteryLevel,
      lat: obs.lat,
      lng: obs.lng,
      eviewEventId: obs.eviewEventId,
      divergent: false,
      divergenceDetails: undefined,
    },
  });
}
