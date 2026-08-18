import { NextResponse } from 'next/server';
import { requireFamilyApiAuth } from '@/lib/admin';
import { revokeWatcher } from '@/lib/family-watchers';

export const dynamic = 'force-dynamic';

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ userDeviceId: string }> },
): Promise<NextResponse> {
  const gate = await requireFamilyApiAuth();
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });
  const userId = gate.userId;
  const { userDeviceId } = await context.params;
  const result = await revokeWatcher(userId, userDeviceId);
  if (!result.ok) {
    const status = result.reason === 'not_found' ? 404 : 403;
    return NextResponse.json({ error: result.reason }, { status });
  }
  return NextResponse.json({ ok: true });
}
