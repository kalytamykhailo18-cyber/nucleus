import { NextResponse } from 'next/server';
import { requireFamilyApiAuth } from '@/lib/admin';
import { markAlertRead } from '@/lib/alerts';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireFamilyApiAuth();
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });
  const userId = gate.userId;

  const { id } = await params;
  const result = await markAlertRead(userId, id);
  if (!result.ok) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
