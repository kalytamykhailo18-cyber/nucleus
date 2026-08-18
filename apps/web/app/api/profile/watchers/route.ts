import { NextResponse } from 'next/server';
import { requireFamilyApiAuth } from '@/lib/admin';
import { listWatchersForMaster } from '@/lib/family-watchers';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const gate = await requireFamilyApiAuth();
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });
  const userId = gate.userId;
  const watchers = await listWatchersForMaster(userId);
  return NextResponse.json({ watchers });
}
