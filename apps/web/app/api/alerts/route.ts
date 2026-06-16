import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/auth';
import { fetchAlertsForUser, ALERTS_PAGE_SIZE } from '@/lib/alerts';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const limitParam = searchParams.get('limit');
  const limit = Math.min(
    Math.max(parseInt(limitParam ?? '', 10) || ALERTS_PAGE_SIZE, 1),
    50,
  );
  const cursor = searchParams.get('cursor');

  const page = await fetchAlertsForUser(userId, { limit, cursor });
  return NextResponse.json(page);
}
