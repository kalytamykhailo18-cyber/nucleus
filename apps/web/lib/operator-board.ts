import { prisma } from '@/lib/db';
import { ALERT_EVENT_TYPES, type AlertEventType } from '@/lib/alerts';

/**
 * Operator board — Phase 2 v0 (Juan business_requirements.md §7.4).
 *
 * The call-center's live priority queue: every alert across every
 * device, newest first, with the inbound device identifier and the
 * timestamp the dispatcher needs to triage. Click-through resolves
 * to /api/callcenter/lookup for the full family roster.
 *
 * Today this is read-only. Per-device chat / response logging /
 * outbound dispatch UI all live downstream once Phase 2 expands.
 */

const PRIORITY: Record<AlertEventType, number> = {
  sos: 1,
  fall_detection: 2,
  geofence_exit: 3,
  geofence_enter: 4,
  battery_low: 5,
  button_press: 6,
};

export interface OperatorBoardAlert {
  id: string;
  deviceId: string;
  deviceLabel: string;
  eventType: AlertEventType;
  priority: number;
  timestamp: string;
  buttonType: string | null;
  batteryLevel: number | null;
  lat: number | null;
  lng: number | null;
  /** True when the operator log has at least one RESOLVED action on this event. */
  isResolved: boolean;
  /** Set only if at least one family member has any role on this device. */
  customerSummary: {
    accountOwnerEmail: string;
    accountOwnerName: string | null;
    seniorName: string | null;
    seniorPhone: string | null;
  } | null;
}

export interface PaginatedOperatorBoard {
  alerts: OperatorBoardAlert[];
  totalRows: number;
  totalPages: number;
  page: number;
  pageSize: number;
}

export async function fetchOperatorBoard(
  page = 1,
  pageSize = 50,
): Promise<PaginatedOperatorBoard> {
  // Exclude test artifacts that fire real EviewEvent rows but never
  // have a UserDevice/Device row to resolve in the caller-ID lookup —
  // clicking those rows shows the modal in its 404 empty state and is
  // 100% noise for the call-center. STEP6UI-* comes from step-06
  // worker E2E specs; E2E-* is the generic prefix used by other dev
  // hooks.
  // STEP6 / E2E- prefix exclusion only — the demo fixture pendants
  // (EV-DEMO-, EV-GEOCRUD-, EV-NOGPS-) stay visible in the operator
  // board so spec coverage of the caller-ID modal / Aura panel /
  // resolve flow runs against real seeded events. Juan's /admin/fleet
  // map filters them out separately because that surface is the
  // device-inventory lens, not the operator workflow lens.
  const where = {
    eventType: { in: ALERT_EVENT_TYPES as unknown as string[] },
    AND: [
      { eviewDeviceId: { not: { startsWith: 'STEP6UI-' } } },
      { eviewDeviceId: { not: { startsWith: 'E2E-' } } },
    ],
  };

  // Server-side dedup: a single physical SOS press can produce two
  // EviewEvent rows because the TS worker (Nucleus) and the legacy
  // Python subscriber (sensu-api, still running during the Phase A
  // bullet-3 parity window) both ingest from the same LocTube broker.
  // Whichever side commits first dedups within its own connection but
  // the other side's transaction is already in flight, so the row
  // lands twice. DISTINCT ON `(deviceId, eventType, timestamp)`
  // collapses them at query time without depending on the per-writer
  // race winning consistently. Drops cleanly to no-op once sensu-api
  // retires (Monday).
  const dedupedRows = await prisma.$queryRaw<
    Array<{
      id: string;
      eviewDeviceId: string;
      eventType: string;
      timestamp: Date;
      buttonType: string | null;
      batteryLevel: number | null;
      lat: number | null;
      lng: number | null;
      deviceName: string | null;
    }>
  >`
    SELECT DISTINCT ON ("eviewDeviceId", "eventType", "timestamp")
      e.id,
      e."eviewDeviceId",
      e."eventType",
      e."timestamp",
      e."buttonType",
      e."batteryLevel",
      e.lat,
      e.lng,
      d."deviceName"
    FROM "EviewEvent" e
    LEFT JOIN "Device" d ON d."deviceId" = e."eviewDeviceId"
    WHERE e."eventType" = ANY (${ALERT_EVENT_TYPES as unknown as string[]})
      AND e."eviewDeviceId" NOT LIKE 'STEP6UI-%'
      AND e."eviewDeviceId" NOT LIKE 'E2E-%'
    ORDER BY e."eviewDeviceId", e."eventType", e."timestamp", e."createdAt" ASC
  `;

  // Re-sort by timestamp desc — the DISTINCT ON above forced an order
  // by the grouping keys to pick the earliest-created row per group.
  dedupedRows.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  const totalRows = dedupedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const events = dedupedRows
    .slice((safePage - 1) * pageSize, safePage * pageSize)
    .map((r) => ({
      id: r.id,
      eviewDeviceId: r.eviewDeviceId,
      eventType: r.eventType,
      timestamp: r.timestamp,
      buttonType: r.buttonType,
      batteryLevel: r.batteryLevel,
      lat: r.lat,
      lng: r.lng,
      device: { deviceName: r.deviceName },
    }));

  // Hydrate the customer summary for each unique device. Bulk query
  // outside the loop so 200 alerts on 30 devices is 1 query, not 200.
  const deviceIds = Array.from(new Set(events.map((e) => e.eviewDeviceId)));
  const masters = deviceIds.length
    ? await prisma.userDevice.findMany({
        where: { eviewDeviceId: { in: deviceIds }, role: 'MASTER' },
        orderBy: { isPrimary: 'desc' },
        select: {
          eviewDeviceId: true,
          user: {
            select: {
              email: true,
              fullName: true,
              userPhone: true,
            },
          },
        },
      })
    : [];

  // For each device, keep the first (= primary) master found.
  const summaryByDevice = new Map<
    string,
    OperatorBoardAlert['customerSummary']
  >();
  for (const m of masters) {
    if (summaryByDevice.has(m.eviewDeviceId)) continue;
    summaryByDevice.set(m.eviewDeviceId, {
      accountOwnerEmail: m.user.email,
      accountOwnerName: m.user.fullName,
      seniorName: m.user.fullName,
      seniorPhone: m.user.userPhone,
    });
  }

  // Mark events that have at least one RESOLVED action on their log.
  // One bulk query keyed by event id so the filter is a Set lookup.
  const eventIds = events.map((e) => e.id);
  const resolvedRows = eventIds.length
    ? await prisma.operatorAction.findMany({
        where: { eviewEventId: { in: eventIds }, kind: 'RESOLVED' },
        select: { eviewEventId: true },
      })
    : [];
  const resolvedSet = new Set(resolvedRows.map((r) => r.eviewEventId));

  const alerts = events
    .map((e) => ({
      id: e.id,
      deviceId: e.eviewDeviceId,
      deviceLabel: e.device.deviceName ?? e.eviewDeviceId,
      eventType: e.eventType as AlertEventType,
      priority: PRIORITY[e.eventType as AlertEventType] ?? 99,
      timestamp: e.timestamp.toISOString(),
      buttonType: e.buttonType,
      batteryLevel: e.batteryLevel,
      lat: e.lat,
      lng: e.lng,
      isResolved: resolvedSet.has(e.id),
      customerSummary: summaryByDevice.get(e.eviewDeviceId) ?? null,
    }))
    .sort((a, b) => {
      // Priority first (SOS at the top regardless of timestamp), then
      // newest within the priority bucket — applied to the page slice.
      if (a.priority !== b.priority) return a.priority - b.priority;
      return b.timestamp.localeCompare(a.timestamp);
    });

  return { alerts, totalRows, totalPages, page: safePage, pageSize };
}
