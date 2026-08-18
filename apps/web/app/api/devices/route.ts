import { NextResponse } from 'next/server';
import { requireFamilyApiAuth } from '@/lib/admin';
import { fetchUserDevices } from '@/lib/devices';

export const dynamic = 'force-dynamic';

export async function GET() {
  const gate = await requireFamilyApiAuth();
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });
  const userId = gate.userId;

  const devices = await fetchUserDevices(userId);
  return NextResponse.json({ devices });
}
