import { prisma } from '@/lib/db';
import { devicePrefixesFor } from '@/lib/admin-exclusions';

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

export async function fetchFleetDevices(
  options: { callcenterMode?: boolean } = {},
): Promise<FleetDevice[]> {
  // Active pendants only. `devicePrefixesFor(callcenterMode)` returns
  // the right exclusion list: lenient = drop only test noise (STEP6,
  // E2E-, e2e-); strict = also drop the entire EV-* synthetic family
  // (EV-DEMO, EV-CLAIM, EV-CLAIMREL, EV-GEOCRUD, EV-NOGPS, etc.) so
  // Juan + the call-center see only real numeric IMEIs.
  const excludedPrefixes = devicePrefixesFor(options.callcenterMode ?? false);
  const raw = await prisma.device.findMany({
    where: {
      isActive: true,
      AND: excludedPrefixes.map((prefix) => ({
        deviceId: { not: { startsWith: prefix } },
      })),
    },
    select: {
      deviceId: true,
      deviceName: true,
      createdAt: true,
    },
  });
  // Juan 2026-06-23: drop all-same-digit placeholder IMEIs (`1111...`,
  // `0000...`) that survived the prefix filter. Real Eview IMEIs never
  // repeat a single digit for 15 places; the placeholder rows polluted
  // the dispatcher's inventory list.
  const devices = options.callcenterMode
    ? raw.filter((d) => !/^(\d)\1{6,}$/.test(d.deviceId))
    : raw;

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

  // Per-device telemetry — bulk Postgres `DISTINCT ON` instead of one
  // findFirst loop per device. The fleet hit 616 active devices, and
  // the prior code ran 3 EviewEvent queries each (1,848 round-trips per
  // page load). Three single DISTINCT ON queries replace that, each one
  // pinning the `EviewEvent_eviewDeviceId_timestamp_idx` index for an
  // ordered scan.
  type LatestRow = {
    eviewDeviceId: string;
    timestamp: Date;
    batteryLevel: number | null;
  };
  type LatestBatteryRow = {
    eviewDeviceId: string;
    batteryLevel: number;
  };
  type LatestFixRow = {
    eviewDeviceId: string;
    lat: number;
    lng: number;
  };
  const [latestEventRows, latestBatteryRows, latestFixRows] = await Promise.all([
    prisma.$queryRaw<LatestRow[]>`
      SELECT DISTINCT ON ("eviewDeviceId")
        "eviewDeviceId",
        "timestamp",
        "batteryLevel"
      FROM "EviewEvent"
      WHERE "eviewDeviceId" = ANY (${deviceIds}::text[])
      ORDER BY "eviewDeviceId", "timestamp" DESC
    `,
    prisma.$queryRaw<LatestBatteryRow[]>`
      SELECT DISTINCT ON ("eviewDeviceId")
        "eviewDeviceId",
        "batteryLevel"
      FROM "EviewEvent"
      WHERE "eviewDeviceId" = ANY (${deviceIds}::text[])
        AND "batteryLevel" IS NOT NULL
      ORDER BY "eviewDeviceId", "timestamp" DESC
    `,
    prisma.$queryRaw<LatestFixRow[]>`
      SELECT DISTINCT ON ("eviewDeviceId")
        "eviewDeviceId",
        "lat",
        "lng"
      FROM "EviewEvent"
      WHERE "eviewDeviceId" = ANY (${deviceIds}::text[])
        AND "lat" IS NOT NULL
        AND "lng" IS NOT NULL
      ORDER BY "eviewDeviceId", "timestamp" DESC
    `,
  ]);

  const latestEventByDevice = new Map(
    latestEventRows.map((r) => [r.eviewDeviceId, r]),
  );
  const latestBatteryByDevice = new Map(
    latestBatteryRows.map((r) => [r.eviewDeviceId, r.batteryLevel]),
  );
  const latestFixByDevice = new Map(
    latestFixRows.map((r) => [r.eviewDeviceId, { lat: r.lat, lng: r.lng }]),
  );

  return devices.map((d) => {
    const latestEvent = latestEventByDevice.get(d.deviceId);
    const fix = latestFixByDevice.get(d.deviceId) ?? null;
    return {
      deviceId: d.deviceId,
      deviceName: d.deviceName,
      masterName: masterByDevice.get(d.deviceId) ?? null,
      createdAt: d.createdAt.toISOString(),
      lat: fix?.lat ?? null,
      lng: fix?.lng ?? null,
      lastSeenAt: latestEvent?.timestamp.toISOString() ?? null,
      batteryLevel:
        latestEvent?.batteryLevel ?? latestBatteryByDevice.get(d.deviceId) ?? null,
    } satisfies FleetDevice;
  });
}
