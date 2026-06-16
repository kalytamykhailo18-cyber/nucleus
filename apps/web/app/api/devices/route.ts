import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { fetchUserDevices } from '@/lib/devices';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const devices = await fetchUserDevices(userId);
  return NextResponse.json({ devices });
}
