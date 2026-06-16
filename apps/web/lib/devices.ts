import { prisma } from '@/lib/db';

export interface DeviceSummary {
  deviceId: string; // Eview device ID (e.g. "EV123456")
  label: string;
  isPrimary: boolean;
  deviceType: string;
  isActive: boolean;
  batteryLevel: number | null;
  batteryThreshold: number;
  lastSeenAt: string | null; // ISO 8601, or null if no event yet
  lat: number | null;
  lng: number | null;
}

/**
 * Returns the user's assigned devices, each enriched with the latest
 * telemetry event (for last-seen) and the most-recent battery reading.
 *
 * Sort order: primary first, then by assignment date so the same user
 * always sees their devices in a stable order.
 *
 * Two queries per device (latest event for last-seen, latest event with
 * a battery reading) — fine at this scale; revisit if a single user
 * accumulates dozens of devices, which is not the Sensu use case.
 */
export async function fetchUserDevices(userId: string): Promise<DeviceSummary[]> {
  const userDevices = await prisma.userDevice.findMany({
    where: { userId },
    include: { device: true },
    orderBy: [{ isPrimary: 'desc' }, { assignedAt: 'asc' }],
  });

  return Promise.all(
    userDevices.map(async (ud) => {
      const [latestEvent, latestBatteryEvent, latestLocationEvent] = await Promise.all([
        prisma.eviewEvent.findFirst({
          where: { eviewDeviceId: ud.eviewDeviceId },
          orderBy: { timestamp: 'desc' },
          select: { timestamp: true, batteryLevel: true },
        }),
        prisma.eviewEvent.findFirst({
          where: {
            eviewDeviceId: ud.eviewDeviceId,
            batteryLevel: { not: null },
          },
          orderBy: { timestamp: 'desc' },
          select: { batteryLevel: true },
        }),
        // Latest event that actually carried a GPS fix. The freshest event
        // overall (`latestEvent`) might be a heartbeat without lat/lng, so
        // we fetch the most recent row that has both columns populated.
        prisma.eviewEvent.findFirst({
          where: {
            eviewDeviceId: ud.eviewDeviceId,
            lat: { not: null },
            lng: { not: null },
          },
          orderBy: { timestamp: 'desc' },
          select: { lat: true, lng: true },
        }),
      ]);

      const fallbackLabel = ud.device.deviceName ?? ud.eviewDeviceId;
      return {
        deviceId: ud.eviewDeviceId,
        label: ud.label ?? fallbackLabel,
        isPrimary: ud.isPrimary,
        deviceType: ud.device.deviceType,
        isActive: ud.device.isActive,
        batteryLevel: latestBatteryEvent?.batteryLevel ?? null,
        batteryThreshold: ud.device.batteryThreshold,
        lastSeenAt: latestEvent?.timestamp
          ? latestEvent.timestamp.toISOString()
          : null,
        lat: latestLocationEvent?.lat ?? null,
        lng: latestLocationEvent?.lng ?? null,
      } satisfies DeviceSummary;
    }),
  );
}
