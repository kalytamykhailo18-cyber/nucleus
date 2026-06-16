import { prisma } from '@/lib/db';

/**
 * Master admin — list every Watcher tied to a device this Master owns,
 * and revoke a single Watcher's seat. The Master cannot revoke their
 * own MASTER row (the dashboard would fall on its face) or anyone else's
 * row on a device they don't own.
 */

export interface WatcherSummary {
  userDeviceId: string;
  userId: string;
  email: string;
  fullName: string | null;
  eviewDeviceId: string;
  deviceLabel: string;
  assignedAt: string;
}

export async function listWatchersForMaster(
  masterUserId: string,
): Promise<WatcherSummary[]> {
  const masterDevices = await prisma.userDevice.findMany({
    where: { userId: masterUserId, role: 'MASTER' },
    select: { eviewDeviceId: true },
  });
  if (masterDevices.length === 0) return [];

  const watchers = await prisma.userDevice.findMany({
    where: {
      role: 'WATCHER',
      eviewDeviceId: { in: masterDevices.map((d) => d.eviewDeviceId) },
    },
    orderBy: { assignedAt: 'desc' },
    select: {
      id: true,
      userId: true,
      eviewDeviceId: true,
      assignedAt: true,
      user: { select: { email: true, fullName: true } },
      device: { select: { deviceName: true } },
    },
  });

  return watchers.map((w) => ({
    userDeviceId: w.id,
    userId: w.userId,
    email: w.user.email,
    fullName: w.user.fullName,
    eviewDeviceId: w.eviewDeviceId,
    deviceLabel: w.device.deviceName ?? w.eviewDeviceId,
    assignedAt: w.assignedAt.toISOString(),
  }));
}

export type RevokeResult =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'forbidden' };

export async function revokeWatcher(
  masterUserId: string,
  userDeviceId: string,
): Promise<RevokeResult> {
  const target = await prisma.userDevice.findUnique({
    where: { id: userDeviceId },
    select: { id: true, eviewDeviceId: true, role: true },
  });
  if (!target) return { ok: false, reason: 'not_found' };
  if (target.role !== 'WATCHER') return { ok: false, reason: 'forbidden' };

  const masterOwns = await prisma.userDevice.findFirst({
    where: {
      userId: masterUserId,
      eviewDeviceId: target.eviewDeviceId,
      role: 'MASTER',
    },
    select: { id: true },
  });
  if (!masterOwns) return { ok: false, reason: 'forbidden' };

  await prisma.userDevice.delete({ where: { id: target.id } });
  return { ok: true };
}
