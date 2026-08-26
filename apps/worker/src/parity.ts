import type { PrismaClient } from '@prisma/client';

/**
 * Retired 2026-08-26. Phase A parity closed with 0 divergences across
 * 3.5 months of observation (verified against `WorkerParityCheck`).
 * Kept writing rows anyway ballooned the table to 518,876 rows and
 * ~161 MB, all of it pure diagnostic scaffolding — the actual event
 * data lives in `EviewEvent` and was never at risk. Truncated the
 * table and turned this function into a no-op so the DB stays clean.
 *
 * Function signature preserved so existing call sites (worker index.ts)
 * compile without change.
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
  _prisma: PrismaClient,
  _source: 'TS' | 'PYTHON',
  _obs: ParityObservation,
): Promise<void> {
  // no-op — see file docstring
}
