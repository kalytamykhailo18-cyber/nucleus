import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { runDripEmailTick } from '@/lib/jobs/drip-emails';

/**
 * POST /api/jobs/drip-tick
 *
 * Internal-only trigger for the drip-email tick. Called by the
 * nucleus-worker process every ten minutes over the docker-compose
 * network, and by /api/dev/run-drip-tick for E2E coverage.
 *
 * Gated by the same `x-e2e-hook-secret` header used by the rest of
 * the internal-routes family — the worker already has the secret in
 * its env, so reusing it avoids carrying a second JOBS_SECRET around.
 * If E2E_HOOKS_SECRET is unset (no internal routes enabled) the
 * route 404s, matching the pattern in /api/dev/*.
 */
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = env.E2E_HOOKS_SECRET;
  if (!secret) return new NextResponse('not found', { status: 404 });
  const provided = request.headers.get('x-e2e-hook-secret');
  if (provided !== secret) return new NextResponse('not found', { status: 404 });

  const result = await runDripEmailTick();
  return NextResponse.json({ ok: true, ...result });
}
