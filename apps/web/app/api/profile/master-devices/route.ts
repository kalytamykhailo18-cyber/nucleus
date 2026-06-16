import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Devices the signed-in user OWNS as Master — used by the invite
 * form on /profile to pick which device to grant a relative access
 * to. Separate from /api/devices so we never accidentally include
 * Watcher rows in the invite-target dropdown.
 */
export async function GET(): Promise<NextResponse> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const rows = await prisma.userDevice.findMany({
    where: { userId, role: 'MASTER' },
    select: {
      eviewDeviceId: true,
      label: true,
      device: { select: { deviceName: true } },
    },
    orderBy: [{ isPrimary: 'desc' }, { assignedAt: 'asc' }],
  });
  const devices = rows.map((r) => ({
    deviceId: r.eviewDeviceId,
    label: r.label ?? r.device.deviceName ?? r.eviewDeviceId,
  }));
  return NextResponse.json({ devices });
}
