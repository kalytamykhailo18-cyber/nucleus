import { NextResponse } from 'next/server';
import { requireFamilyApiAuth } from '@/lib/admin';
import { consumeFamilyInvite } from '@/lib/family-invite';

export const dynamic = 'force-dynamic';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
): Promise<NextResponse> {
  const gate = await requireFamilyApiAuth();
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });
  const { code } = await params;
  const result = await consumeFamilyInvite(code, gate.userId);
  if (result.ok) {
    return NextResponse.json({ ok: true, deviceId: result.deviceId });
  }
  const status =
    result.reason === 'not_found'
      ? 404
      : result.reason === 'already_member'
        ? 200
        : 410;
  return NextResponse.json(
    { ok: false, reason: result.reason },
    { status },
  );
}
