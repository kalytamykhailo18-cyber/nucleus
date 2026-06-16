import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { fetchRegistrations, rowsToCsv } from '@/lib/admin';

/**
 * Streams the registrations table as CSV. Same filters as the admin
 * registrations page. Role-gated server-side — non-admins get a 401.
 *
 * Browser triggers via `<a download>` so the response sets a download
 * filename via Content-Disposition.
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

  const params = request.nextUrl.searchParams;
  const planRaw = params.get('plan');
  const planType =
    planRaw === 'ANGELA_ESENCIAL' || planRaw === 'ANGELA_TOTAL'
      ? planRaw
      : undefined;

  // CSV export bypasses pagination — pull every matching row in one go.
  // The page-size ceiling is intentionally generous; the count query
  // before it caps real-world cost regardless of how high we set this.
  const { rows } = await fetchRegistrations(
    {
      planType,
      fromIso: params.get('from') ?? undefined,
      toIso: params.get('to') ?? undefined,
    },
    1,
    1_000_000,
  );

  const csv = rowsToCsv(rows);
  const datePart = new Date().toISOString().slice(0, 10);
  const filename = `sensu-registrations-${datePart}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  });
}
