import { NextResponse } from 'next/server';
import { requireFamilyApiAuth } from '@/lib/admin';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Devices the signed-in user OWNS as Master — used by the invite
 * form on /profile to pick which device to grant a relative access
 * to. Separate from /api/devices so we never accidentally include
 * Watcher rows in the invite-target dropdown.
 */
export async function GET(): Promise<NextResponse> {
  const gate = await requireFamilyApiAuth();
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });
  const userId = gate.userId;
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
