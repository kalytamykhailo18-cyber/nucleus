import { prisma } from '@/lib/db';

/**
 * Event types that show up in the alert feed. Heartbeats and other
 * telemetry-only rows are deliberately excluded — the feed is for
 * things a family member would want to see / acknowledge, not raw
 * device noise.
 */
export const ALERT_EVENT_TYPES = [
  'sos',
  'fall_detection',
  'battery_low',
  'geofence_enter',
  'geofence_exit',
  'button_press',
] as const;

export type AlertEventType = (typeof ALERT_EVENT_TYPES)[number];

export interface AlertSummary {
  id: string;
  deviceId: string;
  deviceLabel: string;
  eventType: AlertEventType;
  timestamp: string; // ISO 8601
  buttonType: string | null;
  batteryLevel: number | null;
  lat: number | null;
  lng: number | null;
  read: boolean;
  /**
   * ISO timestamp of the earliest OperatorAction the call-center
   * recorded against this alert (audit gap 6 remainder, 2026-08-11).
   * Non-null means the operator has picked up the alert; the family
   * row renders a small "Atendido" pill so the family can tell
   * whether the professional side is already engaged.
   */
  operatorRespondedAt: string | null;
}

export interface AlertsPage {
  alerts: AlertSummary[];
  /** ISO timestamp of the oldest alert in this page. Pass back as
   *  `cursor` to fetch the next page; `null` when no more rows exist. */
  nextCursor: string | null;
}

/**
 * Default page size for the dashboard alert feed. Kept small because the
 * card sits inside a sticky scrolling view — long lists make /dashboard
 * feel heavy. "Cargar más" appends the next page on demand.
 */
export const ALERTS_PAGE_SIZE = 10;

/**
 * Cursor-paginated alert history for a single user, newest first.
 *
 * Only events on devices currently assigned to the user are returned.
 * The read flag comes from the AlertRead join — present row → read,
 * absent → unread.
 *
 * Pagination is cursor-based on `timestamp`: each page returns up to
 * `limit` alerts ordered DESC, plus a `nextCursor` that is the
 * timestamp of the last alert in the page. Passing it back as the
 * `cursor` argument fetches the next page (events with timestamp <
 * cursor). This is stable under inserts — new alerts at the top never
 * shift the page boundaries the way offset pagination would.
 */
export async function fetchAlertsForUser(
  userId: string,
  options: { limit?: number; cursor?: string | null } = {},
): Promise<AlertsPage> {
  const limit = options.limit ?? ALERTS_PAGE_SIZE;
  const cursor = options.cursor ?? null;

  const userDevices = await prisma.userDevice.findMany({
    where: { userId },
    select: {
      eviewDeviceId: true,
      label: true,
      device: { select: { deviceName: true } },
    },
  });

  if (userDevices.length === 0) return { alerts: [], nextCursor: null };

  const deviceIds = userDevices.map((ud) => ud.eviewDeviceId);
  const labelByDeviceId = new Map(
    userDevices.map((ud) => [
      ud.eviewDeviceId,
      ud.label ?? ud.device.deviceName ?? ud.eviewDeviceId,
    ]),
  );

  const where: Record<string, unknown> = {
    eviewDeviceId: { in: deviceIds },
    eventType: { in: ALERT_EVENT_TYPES as unknown as string[] },
  };
  if (cursor) {
    where.timestamp = { lt: new Date(cursor) };
  }

  // Fetch a generous over-count so post-dedup we still have >= limit+1
  // rows when more exist. A single physical SOS press can produce two
  // EviewEvent rows because the TS worker (Nucleus) and the legacy
  // Python subscriber (sensu-api) both ingest from the same LocTube
  // broker — see lib/operator-board.ts for the same fix on the call-
  // center side. Drops to no-op once sensu-api retires (Monday).
  const OVERFETCH = limit * 2 + 4;
  const events = await prisma.eviewEvent.findMany({
    where,
    orderBy: { timestamp: 'desc' },
    take: OVERFETCH,
    select: {
      id: true,
      eviewDeviceId: true,
      eventType: true,
      timestamp: true,
      buttonType: true,
      batteryLevel: true,
      lat: true,
      lng: true,
    },
  });

  // Collapse cross-writer duplicates: a (deviceId, eventType, timestamp)
  // triple is the same logical event regardless of who saved it. Walk
  // the array in timestamp-desc order and keep the first occurrence.
  const seen = new Set<string>();
  const deduped: typeof events = [];
  for (const e of events) {
    const key = `${e.eviewDeviceId}|${e.eventType}|${e.timestamp.getTime()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(e);
  }

  const hasMore = deduped.length > limit;
  const page = hasMore ? deduped.slice(0, limit) : deduped;

  if (page.length === 0) return { alerts: [], nextCursor: null };

  const eventIds = page.map((e) => e.id);
  const [reads, operatorActions] = await Promise.all([
    prisma.alertRead.findMany({
      where: { userId, eviewEventId: { in: eventIds } },
      select: { eviewEventId: true },
    }),
    // Earliest OperatorAction per event — anchors the "Atendido"
    // pill to the moment the call-center first touched the alert,
    // not the most recent action. Any action counts (NOTED,
    // CALLED_SENIOR, PHONED_AURA, RESOLVED, etc.) — the family only
    // needs to know that a professional is engaged.
    prisma.operatorAction.findMany({
      where: { eviewEventId: { in: eventIds } },
      select: { eviewEventId: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);
  const readSet = new Set(reads.map((r) => r.eviewEventId));
  const operatorFirstAtByEvent = new Map<string, Date>();
  for (const action of operatorActions) {
    if (!operatorFirstAtByEvent.has(action.eviewEventId)) {
      operatorFirstAtByEvent.set(action.eviewEventId, action.createdAt);
    }
  }

  const alerts = page.map((e) => ({
    id: e.id,
    deviceId: e.eviewDeviceId,
    deviceLabel: labelByDeviceId.get(e.eviewDeviceId) ?? e.eviewDeviceId,
    eventType: e.eventType as AlertEventType,
    timestamp: e.timestamp.toISOString(),
    buttonType: e.buttonType,
    batteryLevel: e.batteryLevel,
    lat: e.lat,
    lng: e.lng,
    read: readSet.has(e.id),
    operatorRespondedAt:
      operatorFirstAtByEvent.get(e.id)?.toISOString() ?? null,
  }));

  const nextCursor = hasMore ? alerts[alerts.length - 1]!.timestamp : null;
  return { alerts, nextCursor };
}

/**
 * Marks one alert as read for the given user. Idempotent — calling twice
 * is a no-op the second time. Verifies the event belongs to a device the
 * user owns; if not, returns `notFound` so we don't leak existence of
 * other users' alerts via the response shape.
 */
export async function markAlertRead(
  userId: string,
  eventId: string,
): Promise<{ ok: true } | { ok: false; reason: 'notFound' }> {
  const event = await prisma.eviewEvent.findUnique({
    where: { id: eventId },
    select: { eviewDeviceId: true },
  });
  if (!event) return { ok: false, reason: 'notFound' };

  const userOwnsDevice = await prisma.userDevice.findFirst({
    where: { userId, eviewDeviceId: event.eviewDeviceId },
    select: { id: true },
  });
  if (!userOwnsDevice) return { ok: false, reason: 'notFound' };

  await prisma.alertRead.upsert({
    where: { userId_eviewEventId: { userId, eviewEventId: eventId } },
    create: { userId, eviewEventId: eventId },
    update: {},
  });
  return { ok: true };
}
