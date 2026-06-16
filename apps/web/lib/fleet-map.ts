import { prisma } from '@/lib/db';
import { EXCLUDED_DEVICE_PREFIXES } from '@/lib/admin-exclusions';

/**
 * Fleet-wide live map data (Phase B, Juan 2026-05-25 Q1).
 *
 * Returns every active pendant in the fleet with its latest known GPS
 * fix, battery, and last-seen timestamp, plus the master user's name
 * so the call-center can identify the senior at a glance from the map
 * pin without opening the operator board's caller-ID modal.
 *
 * Same noise filter as parity.ts — `STEP6*` (which covers `STEP6-`,
 * `STEP6B-`, and `STEP6UI-`) plus `E2E-`. All of these come from
 * worker-spec MQTT traffic and don't have a UserDevice to resolve,
 * so they'd just clutter the map and (more importantly) bury real
 * inventory rows under hundreds of synthetic IMEIs.
 */

export interface FleetDevice {
  deviceId: string;
  deviceName: string | null;
  /** Master user's full name, or null when no master is linked. */
  masterName: string | null;
  /** When the Device row was created; used to surface the freshest B2B
   *  inventory at the top of the unassigned section in /admin/fleet. */
  createdAt: string;
  /** Last GPS fix; null when the device has never reported lat/lng. */
  lat: number | null;
  lng: number | null;
  /** Most-recent telemetry timestamp, ISO 8601, or null. */
  lastSeenAt: string | null;
  /** Most-recent battery reading, 0-100, or null. */
  batteryLevel: number | null;
}

export async function fetchFleetDevices(): Promise<FleetDevice[]> {
  // Active pendants only. EXCLUDED_DEVICE_PREFIXES drops every
  // synthetic / fixture id from the human-facing map: worker-spec
  // STEP6* / E2E- noise, the lowercase e2e- variants, and the seeded
  // demo / geocrud / nogps pendants from the demo fixture. The list
  // is shared with the operator board so the two surfaces never
  // disagree on what counts as a "real" device.
  const devices = await prisma.device.findMany({
    where: {
      isActive: true,
      AND: EXCLUDED_DEVICE_PREFIXES.map((prefix) => ({
        deviceId: { not: { startsWith: prefix } },
      })),
    },
    select: {
      deviceId: true,
      deviceName: true,
      createdAt: true,
    },
  });

  if (devices.length === 0) return [];

  const deviceIds = devices.map((d) => d.deviceId);

  // Bulk fetch the master for each device so the loop below is O(1) lookup.
  const masters = await prisma.userDevice.findMany({
    where: { eviewDeviceId: { in: deviceIds }, role: 'MASTER' },
    orderBy: { isPrimary: 'desc' },
    select: {
      eviewDeviceId: true,
      user: { select: { fullName: true } },
    },
  });
  const masterByDevice = new Map<string, string | null>();
  for (const m of masters) {
    if (masterByDevice.has(m.eviewDeviceId)) continue;
    masterByDevice.set(m.eviewDeviceId, m.user.fullName);
  }

  // Per-device telemetry. Three small queries per device is fine for
  // fleet sizes up to a few hundred; revisit with a window function /
  // raw SQL if the fleet crosses ~1k.
  return Promise.all(
    devices.map(async (d) => {
      const [latestEvent, latestBattery, latestFix] = await Promise.all([
        prisma.eviewEvent.findFirst({
          where: { eviewDeviceId: d.deviceId },
          orderBy: { timestamp: 'desc' },
          select: { timestamp: true, batteryLevel: true },
        }),
        prisma.eviewEvent.findFirst({
          where: {
            eviewDeviceId: d.deviceId,
            batteryLevel: { not: null },
          },
          orderBy: { timestamp: 'desc' },
          select: { batteryLevel: true },
        }),
        prisma.eviewEvent.findFirst({
          where: {
            eviewDeviceId: d.deviceId,
            lat: { not: null },
            lng: { not: null },
          },
          orderBy: { timestamp: 'desc' },
          select: { lat: true, lng: true },
        }),
      ]);

      return {
        deviceId: d.deviceId,
        deviceName: d.deviceName,
        masterName: masterByDevice.get(d.deviceId) ?? null,
        createdAt: d.createdAt.toISOString(),
        lat: latestFix?.lat ?? null,
        lng: latestFix?.lng ?? null,
        lastSeenAt: latestEvent?.timestamp.toISOString() ?? null,
        batteryLevel:
          latestEvent?.batteryLevel ?? latestBattery?.batteryLevel ?? null,
      } satisfies FleetDevice;
    }),
  );
}
