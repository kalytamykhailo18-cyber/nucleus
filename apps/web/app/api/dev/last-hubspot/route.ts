import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';

/**
 * Test-only seam: returns the most recent HubSpot contact upsert recorded
 * for a given email. Phase A+ #2 specs use this to assert on the
 * signup_source / nucleus_plan / nucleus_price_mxn payload without
 * needing reachability to the real HubSpot API from CI.
 *
 * Same gate as /api/dev/last-email: requires E2E_HOOKS_SECRET to be set
 * and echoed in X-E2E-Hook-Secret. Production leaves the env unset and
 * every request 404s.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const secret = env.E2E_HOOKS_SECRET;
  if (!secret) {
    return new NextResponse('not found', { status: 404 });
  }
  const provided = request.headers.get('x-e2e-hook-secret');
  if (provided !== secret) {
    return new NextResponse('not found', { status: 404 });
  }

  const email = request.nextUrl.searchParams.get('email');
  if (!email) {
    return NextResponse.json({ error: 'missing ?email=' }, { status: 400 });
  }

  const row = await prisma.hubSpotOutboxTest.findFirst({
    where: { email: email.toLowerCase() },
    orderBy: { createdAt: 'desc' },
  });
  if (!row) {
    return NextResponse.json({ found: false });
  }
  return NextResponse.json({
    found: true,
    email: row.email,
    source: row.source,
    payload: row.payload,
    createdAt: row.createdAt,
  });
}
