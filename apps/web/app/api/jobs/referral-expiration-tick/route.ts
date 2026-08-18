import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { expirePendingReferrals } from '@/lib/referrals';

/**
 * POST /api/jobs/referral-expiration-tick
 *
 * Internal-only sweep that flips PENDING referrals older than
 * `REFERRAL_EXPIRATION_DAYS` (90 by default) to EXPIRED. Called by
 * the nucleus-worker scheduler once a day and by the Playwright spec
 * via `?olderThanDays=0` to fast-forward without seeding 90-day-old
 * rows.
 *
 * Gated by the same `x-e2e-hook-secret` header as the rest of the
 * `/api/jobs/*` family. If E2E_HOOKS_SECRET is unset the route 404s.
 */
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = env.E2E_HOOKS_SECRET;
  if (!secret) return new NextResponse('not found', { status: 404 });
  const provided = request.headers.get('x-e2e-hook-secret');
  if (provided !== secret) return new NextResponse('not found', { status: 404 });

  const overrideRaw = request.nextUrl.searchParams.get('olderThanDays');
  const olderThanDays =
    overrideRaw !== null && Number.isFinite(Number(overrideRaw))
      ? Math.max(0, Number(overrideRaw))
      : undefined;

  const result = await expirePendingReferrals({ olderThanDays });
  return NextResponse.json({ ok: true, ...result });
}
