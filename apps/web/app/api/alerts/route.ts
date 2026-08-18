import { NextResponse, type NextRequest } from 'next/server';
import { requireFamilyApiAuth } from '@/lib/admin';
import { fetchAlertsForUser, ALERTS_PAGE_SIZE } from '@/lib/alerts';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const gate = await requireFamilyApiAuth();
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });
  const userId = gate.userId;

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
