import { NextResponse } from 'next/server';
import { requireFamilyApiAuth } from '@/lib/admin';
import { getPublicInvite, revokeInvite } from '@/lib/family-invite';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
): Promise<NextResponse> {
  const { code } = await params;
  const view = await getPublicInvite(code);
  if (!view) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json(view);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
): Promise<NextResponse> {
  const gate = await requireFamilyApiAuth();
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });
  const userId = gate.userId;
  const { code } = await params;
  const removed = await revokeInvite(code, userId);
  if (!removed) {
    return NextResponse.json({ error: 'not_found_or_consumed' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
