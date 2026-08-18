import { NextResponse } from 'next/server';
import { requireFamilyApiAuth } from '@/lib/admin';
import { prisma } from '@/lib/db';

/**
 * DELETE /api/devices/[deviceId] — customer-side unpair.
 *
 * Removes the UserDevice row that links the signed-in user to the
 * device. The Device row itself stays — other users or the admin
 * fleet inventory may still reference it. Only the requesting user's
 * own pairing is affected.
 *
 * Juan asked for this 2026-06-16: he wanted to drop the seeded demo
 * devices from his dashboard and keep only his real EV-12 pendant.
 */
export const dynamic = 'force-dynamic';

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ deviceId: string }> },
): Promise<NextResponse> {
  const gate = await requireFamilyApiAuth();
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });
  const userId = gate.userId;
  const { deviceId } = await ctx.params;
  const result = await prisma.userDevice.deleteMany({
    where: { userId, eviewDeviceId: deviceId },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, removed: result.count });
}
