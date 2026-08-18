import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { ALERT_EVENT_TYPES, type AlertEventType } from '@/lib/alerts';
import { devicePrefixesFor } from '@/lib/admin-exclusions';

/**
 * Same emergency-event-type filter the operator-board fetcher applies.
 * Device-prefix exclusion comes from the shared `devicePrefixesFor`
 * helper so the operator queue + map + reporting all agree on what
 * counts as a synthetic device ID.
 */
const CALLCENTER_EMERGENCY_EVENT_TYPES: AlertEventType[] = [
  'sos',
  'fall_detection',
];

/**
 * Operator map alerts (Phase B polish, 2026-06-10).
 *
 * Every actionable unresolved EviewEvent from the last 24 hours that
 * carries lat/lng, joined to the operator who took the latest action
 * on it (null = unclaimed). The /admin/operator console renders these
 * as a Leaflet overlay colored per operator so the dispatcher sees at
 * a glance who is owning which alert geographically.
 *
 * "Unresolved" = latest OperatorAction is not RESOLVED. "Actionable" =
 * eventType in ALERT_EVENT_TYPES. Same E2E / STEP6 noise filters apply
 * as in the operator-board query.
 *
 * Fallback rule: if the event row itself lacks lat/lng (rare for SOS,
 * common for some battery_low rows) we skip it — a marker needs
 * coordinates, and there is no honest stand-in.
 */

const LOOKBACK_HOURS = 24;

export interface OperatorMapAlert {
  eventId: string;
  deviceId: string;
  deviceName: string | null;
  alertType: string;
  occurredAt: string;
  lat: number;
  lng: number;
  /** Null when no OperatorAction exists yet (unclaimed). */
  operatorId: string | null;
}

export async function fetchOperatorMapAlerts(
  options: { callcenterMode?: boolean } = {},
): Promise<OperatorMapAlert[]> {
  const since = new Date(Date.now() - LOOKBACK_HOURS * 3_600_000);
  const eventTypes = options.callcenterMode
    ? CALLCENTER_EMERGENCY_EVENT_TYPES
    : (ALERT_EVENT_TYPES as unknown as AlertEventType[]);
  const excludedDevicePrefixes = devicePrefixesFor(
    options.callcenterMode ?? false,
  );
  const devicePrefixSql = Prisma.sql`AND ${Prisma.join(
    excludedDevicePrefixes.map(
      (p) => Prisma.sql`e."eviewDeviceId" NOT LIKE ${p + '%'}`,
    ),
    ' AND ',
  )}`;

  // Latest OperatorAction per event — DISTINCT ON keeps the most
  // recent row. Filter out events whose latest action is RESOLVED so
  // closed alerts drop off the map.
  type LatestRow = {
    eviewEventId: string;
    operatorUserId: string;
    kind: string;
  };
  const latest = await prisma.$queryRaw<LatestRow[]>`
    SELECT DISTINCT ON (a."eviewEventId")
      a."eviewEventId", a."operatorUserId", a."kind"
    FROM "OperatorAction" a
    INNER JOIN "EviewEvent" e ON e.id = a."eviewEventId"
    WHERE e."eventType" = ANY(${eventTypes as readonly string[]}::text[])
      AND e."timestamp" >= ${since}
      ${devicePrefixSql}
    ORDER BY a."eviewEventId", a."createdAt" DESC
  `;
  const operatorByEvent = new Map<string, string>();
  const resolvedEventIds = new Set<string>();
  for (const row of latest) {
    if (row.kind === 'RESOLVED') {
      resolvedEventIds.add(row.eviewEventId);
      continue;
    }
    operatorByEvent.set(row.eviewEventId, row.operatorUserId);
  }

  // All actionable events from the last window with lat/lng. Resolved
  // ones get filtered out in JS after the latest-action lookup above.
  const events = await prisma.eviewEvent.findMany({
    where: {
      timestamp: { gte: since },
      eventType: { in: eventTypes as unknown as string[] },
      lat: { not: null },
      lng: { not: null },
      AND: excludedDevicePrefixes.map((p) => ({
        eviewDeviceId: { not: { startsWith: p } },
      })),
    },
    select: {
      id: true,
      eviewDeviceId: true,
      eventType: true,
      timestamp: true,
      lat: true,
      lng: true,
      device: { select: { deviceName: true } },
    },
    orderBy: { timestamp: 'desc' },
  });

  return events
    .filter((e) => !resolvedEventIds.has(e.id))
    .map((e) => ({
      eventId: e.id,
      deviceId: e.eviewDeviceId,
      deviceName: e.device?.deviceName ?? null,
      alertType: e.eventType,
      occurredAt: e.timestamp.toISOString(),
      lat: e.lat as number,
      lng: e.lng as number,
      operatorId: operatorByEvent.get(e.id) ?? null,
    }));
}
