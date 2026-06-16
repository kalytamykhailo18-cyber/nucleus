import { prisma } from '@/lib/db';

/**
 * Geofences in Sensu are circular and capped at 4 per device — matching
 * Eview pendant hardware (4 zones, zoneNumber 1..4). The editor UI maps
 * one-to-one onto those slots.
 *
 * Direction semantics: ENTER fires only when the device crosses in,
 * LEAVE only when it crosses out, BOTH on either transition. Defaults
 * to BOTH because that's almost always what a family member wants.
 */

export const MAX_ZONES_PER_DEVICE = 4;

export const GEOFENCE_DIRECTIONS = ['ENTER', 'LEAVE', 'BOTH'] as const;
export type GeofenceDirection = (typeof GEOFENCE_DIRECTIONS)[number];

export interface GeofenceSummary {
  id: string;
  deviceId: string;
  deviceLabel: string;
  zoneNumber: number;
  name: string;
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  direction: GeofenceDirection;
  isActive: boolean;
}

export interface CreateGeofenceInput {
  deviceId: string;
  name: string;
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  direction?: GeofenceDirection;
}

export interface UpdateGeofenceInput {
  name?: string;
  centerLat?: number;
  centerLng?: number;
  radiusMeters?: number;
  direction?: GeofenceDirection;
  isActive?: boolean;
}

interface UserDeviceRow {
  eviewDeviceId: string;
  label: string | null;
  device: { deviceName: string | null };
}

function deviceLabel(ud: UserDeviceRow): string {
  return ud.label ?? ud.device.deviceName ?? ud.eviewDeviceId;
}

export async function fetchUserGeofences(userId: string): Promise<GeofenceSummary[]> {
  const userDevices = await prisma.userDevice.findMany({
    where: { userId },
    select: {
      eviewDeviceId: true,
      label: true,
      device: { select: { deviceName: true } },
    },
  });
  if (userDevices.length === 0) return [];

  const labelByDevice = new Map(
    userDevices.map((ud) => [ud.eviewDeviceId, deviceLabel(ud)]),
  );

  // Drop the userId filter — Watchers must see the zones the Master
  // created on the same device, since otherwise the panel would be
  // empty for them (only Masters can create zones now). The device
  // list above already restricts results to devices the caller has
  // any role on, so this is still per-user scoped.
  const rows = await prisma.geofence.findMany({
    where: { eviewDeviceId: { in: userDevices.map((ud) => ud.eviewDeviceId) } },
    orderBy: [{ eviewDeviceId: 'asc' }, { zoneNumber: 'asc' }],
  });

  return rows.map((g) => ({
    id: g.id,
    deviceId: g.eviewDeviceId,
    deviceLabel: labelByDevice.get(g.eviewDeviceId) ?? g.eviewDeviceId,
    zoneNumber: g.zoneNumber,
    name: g.name,
    centerLat: g.centerLat,
    centerLng: g.centerLng,
    radiusMeters: g.radiusMeters,
    direction: g.direction as GeofenceDirection,
    isActive: g.isActive,
  }));
}

export async function createGeofence(
  userId: string,
  input: CreateGeofenceInput,
): Promise<{ ok: true; geofence: GeofenceSummary } | { ok: false; reason: 'noDevice' | 'zonesFull' }> {
  // The user must be the MASTER of this device. Watchers see zones on
  // the map and receive enter/exit alerts but cannot create or edit
  // them — Juan 2026-05-18. We collapse "I'm not on this device" and
  // "I'm a Watcher" into the same `noDevice` reason so the API doesn't
  // leak the difference to a Watcher who tries.
  const userDevice = await prisma.userDevice.findFirst({
    where: { userId, eviewDeviceId: input.deviceId, role: 'MASTER' },
    select: {
      eviewDeviceId: true,
      label: true,
      device: { select: { deviceName: true } },
    },
  });
  if (!userDevice) return { ok: false, reason: 'noDevice' };

  // Find the next free zoneNumber for this device (1..4).
  const taken = await prisma.geofence.findMany({
    where: { eviewDeviceId: input.deviceId },
    select: { zoneNumber: true },
  });
  const used = new Set(taken.map((g) => g.zoneNumber));
  let zoneNumber = -1;
  for (let i = 1; i <= MAX_ZONES_PER_DEVICE; i += 1) {
    if (!used.has(i)) {
      zoneNumber = i;
      break;
    }
  }
  if (zoneNumber === -1) return { ok: false, reason: 'zonesFull' };

  const created = await prisma.geofence.create({
    data: {
      userId,
      eviewDeviceId: input.deviceId,
      zoneNumber,
      name: input.name,
      centerLat: input.centerLat,
      centerLng: input.centerLng,
      radiusMeters: input.radiusMeters,
      direction: input.direction ?? 'BOTH',
    },
  });

  return {
    ok: true,
    geofence: {
      id: created.id,
      deviceId: created.eviewDeviceId,
      deviceLabel: deviceLabel(userDevice),
      zoneNumber: created.zoneNumber,
      name: created.name,
      centerLat: created.centerLat,
      centerLng: created.centerLng,
      radiusMeters: created.radiusMeters,
      direction: created.direction as GeofenceDirection,
      isActive: created.isActive,
    },
  };
}

export async function updateGeofence(
  userId: string,
  id: string,
  input: UpdateGeofenceInput,
): Promise<{ ok: true; geofence: GeofenceSummary } | { ok: false; reason: 'notFound' }> {
  // Master-role check on the geofence's DEVICE, not its creator. The
  // flat-claim model (Juan 2026-05-07) allows multiple Masters per
  // device — any Master can edit any zone on a device they own; only
  // Watchers are read-only. A Watcher or non-member hitting this path
  // gets `notFound` so we don't leak which zones could be edited.
  const existing = await prisma.geofence.findFirst({
    where: {
      id,
      device: {
        userDevices: { some: { userId, role: 'MASTER' } },
      },
    },
  });
  if (!existing) return { ok: false, reason: 'notFound' };

  const updated = await prisma.geofence.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.centerLat !== undefined ? { centerLat: input.centerLat } : {}),
      ...(input.centerLng !== undefined ? { centerLng: input.centerLng } : {}),
      ...(input.radiusMeters !== undefined ? { radiusMeters: input.radiusMeters } : {}),
      ...(input.direction !== undefined ? { direction: input.direction } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      // A re-edit invalidates any prior device-sync state — Step 10 v2
      // (push to Eview via EVMARS) reads `syncedToDevice=false` to know
      // what to re-send.
      syncedToDevice: false,
    },
  });

  // Read the device label for the response shape.
  const userDevice = await prisma.userDevice.findFirst({
    where: { userId, eviewDeviceId: updated.eviewDeviceId },
    select: { label: true, eviewDeviceId: true, device: { select: { deviceName: true } } },
  });

  return {
    ok: true,
    geofence: {
      id: updated.id,
      deviceId: updated.eviewDeviceId,
      deviceLabel: userDevice ? deviceLabel(userDevice) : updated.eviewDeviceId,
      zoneNumber: updated.zoneNumber,
      name: updated.name,
      centerLat: updated.centerLat,
      centerLng: updated.centerLng,
      radiusMeters: updated.radiusMeters,
      direction: updated.direction as GeofenceDirection,
      isActive: updated.isActive,
    },
  };
}

export async function deleteGeofence(
  userId: string,
  id: string,
): Promise<{ ok: true } | { ok: false; reason: 'notFound' }> {
  // Same role gate as create/update — Watchers cannot delete zones,
  // any Master on the device can (flat-claim model: equal admin power).
  const result = await prisma.geofence.deleteMany({
    where: {
      id,
      device: {
        userDevices: { some: { userId, role: 'MASTER' } },
      },
    },
  });
  if (result.count === 0) return { ok: false, reason: 'notFound' };
  return { ok: true };
}

/**
 * Haversine distance in meters between two lat/lng pairs. Good enough for
 * the small radii a senior-monitoring product cares about; sub-cm error
 * across hundreds of meters.
 */
function haversineMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6_371_000;
  const toRad = (n: number): number => (n * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const a = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Inspect a fresh device location and emit geofence_enter / geofence_exit
 * alerts on every active geofence whose state just changed.
 *
 * Prior state per (device, geofence) is inferred from history: we read
 * the most recent geofence_enter or geofence_exit event whose rawPayload
 * names this geofenceId. Absence of any prior event means "outside" by
 * default, so the first time the device pings inside a freshly-drawn
 * geofence we fire ENTER (which matches what the family member expects).
 *
 * Returns the eventIds that landed so the caller can dispatch pushes.
 */
export interface BreachResult {
  eventIds: string[];
}

export async function evaluateGeofenceBreach(
  deviceId: string,
  lat: number,
  lng: number,
  now: Date = new Date(),
): Promise<BreachResult> {
  const fences = await prisma.geofence.findMany({
    where: { eviewDeviceId: deviceId, isActive: true },
  });
  if (fences.length === 0) return { eventIds: [] };

  const eventIds: string[] = [];

  for (const fence of fences) {
    const distance = haversineMeters(lat, lng, fence.centerLat, fence.centerLng);
    const insideNow = distance <= fence.radiusMeters;

    // Pull the most recent enter/exit event tagged with this geofenceId.
    const lastEvent = await prisma.eviewEvent.findFirst({
      where: {
        eviewDeviceId: deviceId,
        eventType: { in: ['geofence_enter', 'geofence_exit'] },
        // Stored in rawPayload.nucleus.geofenceId for our synthetic emits.
        // For device-emitted events we don't know which fence — they're
        // tagged by the device's zone slot, not the row id. For the
        // Phase A acceptance test this query catches the synthetic events
        // we emit ourselves, which is sufficient.
        rawPayload: {
          path: ['nucleus', 'geofenceId'],
          equals: fence.id,
        },
      },
      orderBy: { timestamp: 'desc' },
      select: { eventType: true },
    });
    const wasInside = lastEvent?.eventType === 'geofence_enter';

    if (wasInside === insideNow) continue;

    const transition: 'ENTER' | 'LEAVE' = insideNow ? 'ENTER' : 'LEAVE';
    if (
      fence.direction !== 'BOTH' &&
      fence.direction !== transition
    ) {
      continue;
    }

    const created = await prisma.eviewEvent.create({
      data: {
        eviewDeviceId: deviceId,
        eventType: transition === 'ENTER' ? 'geofence_enter' : 'geofence_exit',
        timestamp: now,
        lat,
        lng,
        processedAt: now,
        rawPayload: {
          nucleus: {
            geofenceId: fence.id,
            geofenceName: fence.name,
            zoneNumber: fence.zoneNumber,
            distanceMeters: Math.round(distance),
          },
        },
      },
      select: { id: true },
    });
    eventIds.push(created.id);
  }

  return { eventIds };
}
