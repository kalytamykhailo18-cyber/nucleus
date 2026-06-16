import { prisma } from '@/lib/db';
import { ALERT_EVENT_TYPES } from '@/lib/alerts';

/**
 * Per-device timeline (Phase B closer, 2026-06-15).
 *
 * One call gathers the full read-only picture for one IMEI:
 *   - device meta (model, phone, settings)
 *   - the master user that owns it (call-center caller-ID anchor)
 *   - the GPS trail across the last N events that carried a fix
 *   - the battery curve across the last N events that reported it
 *   - the recent alert events with their OperatorAction audit summary
 *
 * The page renders all four from this one payload; no per-row fetches.
 */

const EVENT_FETCH_LIMIT = 200;
const ALERT_FETCH_LIMIT = 30;

export interface DeviceTimelineMeta {
  imei: string;
  deviceName: string | null;
  deviceType: string;
  phoneNumber: string | null;
  isActive: boolean;
  batteryThreshold: number;
  fallDetectionEnabled: boolean;
  ownerUserId: string | null;
  ownerFullName: string | null;
  ownerEmail: string | null;
}

export interface DeviceTimelineGpsPoint {
  timestamp: string;
  lat: number;
  lng: number;
  accuracyMeters: number | null;
  isGps: boolean;
  eventType: string;
}

export interface DeviceTimelineBatteryPoint {
  timestamp: string;
  batteryLevel: number;
}

export interface DeviceTimelineAlertAction {
  kind: string;
  operatorEmail: string;
  note: string | null;
  createdAt: string;
}

export interface DeviceTimelineAlert {
  id: string;
  eventType: string;
  timestamp: string;
  lat: number | null;
  lng: number | null;
  batteryLevel: number | null;
  buttonType: string | null;
  actions: DeviceTimelineAlertAction[];
}

export interface DeviceTimeline {
  meta: DeviceTimelineMeta;
  gpsTrail: DeviceTimelineGpsPoint[];
  batteryCurve: DeviceTimelineBatteryPoint[];
  alerts: DeviceTimelineAlert[];
  lastSeenAt: string | null;
  latestBattery: number | null;
  alertCount30d: number;
  totalEventCount: number;
}

export async function fetchDeviceTimeline(
  imei: string,
): Promise<DeviceTimeline | null> {
  const device = await prisma.device.findUnique({
    where: { deviceId: imei },
    select: {
      deviceId: true,
      deviceName: true,
      deviceType: true,
      phoneNumber: true,
      isActive: true,
      batteryThreshold: true,
      fallDetectionEnabled: true,
      userDevices: {
        orderBy: [{ isPrimary: 'desc' }, { assignedAt: 'asc' }],
        take: 1,
        select: {
          user: {
            select: { id: true, fullName: true, email: true },
          },
        },
      },
    },
  });
  if (!device) return null;

  const owner = device.userDevices[0]?.user ?? null;

  const recentEvents = await prisma.eviewEvent.findMany({
    where: { eviewDeviceId: imei },
    orderBy: { timestamp: 'desc' },
    take: EVENT_FETCH_LIMIT,
    select: {
      id: true,
      eventType: true,
      timestamp: true,
      lat: true,
      lng: true,
      batteryLevel: true,
      accuracyMeters: true,
      isGps: true,
      buttonType: true,
    },
  });

  const gpsTrail: DeviceTimelineGpsPoint[] = recentEvents
    .filter((e) => e.lat !== null && e.lng !== null)
    .slice(0, 80)
    .map((e) => ({
      timestamp: e.timestamp.toISOString(),
      lat: e.lat as number,
      lng: e.lng as number,
      accuracyMeters: e.accuracyMeters,
      isGps: e.isGps,
      eventType: e.eventType,
    }));

  const batteryCurve: DeviceTimelineBatteryPoint[] = recentEvents
    .filter((e) => typeof e.batteryLevel === 'number')
    .slice(0, 80)
    .map((e) => ({
      timestamp: e.timestamp.toISOString(),
      batteryLevel: e.batteryLevel as number,
    }))
    .reverse();

  const alertEvents = recentEvents.filter((e) =>
    (ALERT_EVENT_TYPES as readonly string[]).includes(e.eventType),
  );
  const alertIds = alertEvents.slice(0, ALERT_FETCH_LIMIT).map((e) => e.id);
  const actions = alertIds.length
    ? await prisma.operatorAction.findMany({
        where: { eviewEventId: { in: alertIds } },
        orderBy: { createdAt: 'asc' },
        select: {
          eviewEventId: true,
          kind: true,
          note: true,
          createdAt: true,
          operator: { select: { email: true } },
        },
      })
    : [];
  const actionsByEvent = new Map<string, DeviceTimelineAlertAction[]>();
  for (const a of actions) {
    const arr = actionsByEvent.get(a.eviewEventId) ?? [];
    arr.push({
      kind: a.kind,
      operatorEmail: a.operator.email,
      note: a.note,
      createdAt: a.createdAt.toISOString(),
    });
    actionsByEvent.set(a.eviewEventId, arr);
  }
  const alerts: DeviceTimelineAlert[] = alertEvents
    .slice(0, ALERT_FETCH_LIMIT)
    .map((e) => ({
      id: e.id,
      eventType: e.eventType,
      timestamp: e.timestamp.toISOString(),
      lat: e.lat,
      lng: e.lng,
      batteryLevel: e.batteryLevel,
      buttonType: e.buttonType,
      actions: actionsByEvent.get(e.id) ?? [],
    }));

  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [alertCount30d, totalEventCount] = await Promise.all([
    prisma.eviewEvent.count({
      where: {
        eviewDeviceId: imei,
        timestamp: { gte: since30d },
        eventType: { in: [...ALERT_EVENT_TYPES] },
      },
    }),
    prisma.eviewEvent.count({ where: { eviewDeviceId: imei } }),
  ]);

  const latestBatteryRow = recentEvents.find(
    (e) => typeof e.batteryLevel === 'number',
  );

  return {
    meta: {
      imei: device.deviceId,
      deviceName: device.deviceName,
      deviceType: device.deviceType,
      phoneNumber: device.phoneNumber,
      isActive: device.isActive,
      batteryThreshold: device.batteryThreshold,
      fallDetectionEnabled: device.fallDetectionEnabled,
      ownerUserId: owner?.id ?? null,
      ownerFullName: owner?.fullName ?? null,
      ownerEmail: owner?.email ?? null,
    },
    gpsTrail,
    batteryCurve,
    alerts,
    lastSeenAt: recentEvents[0]?.timestamp.toISOString() ?? null,
    latestBattery: latestBatteryRow?.batteryLevel ?? null,
    alertCount30d,
    totalEventCount,
  };
}
