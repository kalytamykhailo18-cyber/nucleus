import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { fetchParitySummary, fetchParityRecent } from '@/lib/parity';

/**
 * Admin-only read of the parity stream — returns summary stats + the
 * 20 most recent rows for the dashboard. Phase A: Python rows arrive
 * once sensu-api is patched to call /api/dev/parity-mirror; until then
 * the dashboard shows TS-only counts (divergentCount=0 trivially).
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const since = request.nextUrl.searchParams.get('since') ?? undefined;
  const pageRaw = request.nextUrl.searchParams.get('page');
  const page = (() => {
    const n = Number(pageRaw);
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
  })();
  const [summary, recent] = await Promise.all([
    fetchParitySummary(since),
    fetchParityRecent(page, 20),
  ]);
  return NextResponse.json({ summary, recent: recent.rows, pagination: {
    totalRows: recent.totalRows,
    totalPages: recent.totalPages,
    page: recent.page,
    pageSize: recent.pageSize,
  } });
}
