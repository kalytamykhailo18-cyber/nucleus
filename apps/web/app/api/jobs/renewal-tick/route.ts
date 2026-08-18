import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { runRenewalTick } from '@/lib/renewal';

/**
 * POST /api/jobs/renewal-tick
 *
 * Hourly sweep that drives the three renewal phases (reminders,
 * charge attempts, grace-period expiry). Same secret gate as the
 * rest of the `/api/jobs/*` family — 404 without it.
 *
 * Accepts an `?overrideReminderWindowDays=N` query param for the
 * Playwright spec so we can assert reminder-send logic without
 * seeding 7-day-out rows.
 */
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = env.E2E_HOOKS_SECRET;
  if (!secret) return new NextResponse('not found', { status: 404 });
  const provided = request.headers.get('x-e2e-hook-secret');
  if (provided !== secret) return new NextResponse('not found', { status: 404 });

  const overrideRaw = request.nextUrl.searchParams.get(
    'overrideReminderWindowDays',
  );
  const overrideReminderWindowDays =
    overrideRaw !== null && Number.isFinite(Number(overrideRaw))
      ? Math.max(0, Number(overrideRaw))
      : undefined;

  const result = await runRenewalTick({ overrideReminderWindowDays });
  return NextResponse.json({ ok: true, ...result });
}
