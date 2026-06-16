import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { listWatchersForMaster } from '@/lib/family-watchers';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const watchers = await listWatchersForMaster(userId);
  return NextResponse.json({ watchers });
}
