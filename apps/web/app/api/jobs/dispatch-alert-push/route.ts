import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { env } from '@/lib/env';
import { dispatchAlertPush } from '@/lib/push-dispatch';

/**
 * POST /api/jobs/dispatch-alert-push
 *
 * Internal worker → web bridge (Juan 2026-08-07). The MQTT worker
 * used to run its own push dispatcher which only ever emitted the
 * LEGACY payload shape (no tier, no actions, no silent flag) and only
 * fanned to family. Real pendant fires therefore missed everything
 * Steps 4-8 added: the "Ya lo estoy investigando" action, tiered
 * vibration, silent standard-tier, and the call-center audience.
 *
 * Now the worker POSTs a bare alert descriptor here and this route
 * runs the same `dispatchAlertPush` the seed-alert dev seam does, so
 * the pendant path and the E2E path share one dispatcher and one
 * payload contract.
 *
 * Gated by the same E2E_HOOKS_SECRET the other /api/jobs/* routes
 * use (worker-side already has this env).
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  deviceId: z.string().min(1),
  type: z.string().min(1),
  eventId: z.string().min(1),
  timestamp: z.string().min(1),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = env.E2E_HOOKS_SECRET;
  if (!secret) return new NextResponse('not found', { status: 404 });
  const provided = request.headers.get('x-e2e-hook-secret');
  if (provided !== secret) return new NextResponse('not found', { status: 404 });

  const raw = await request.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { deviceId, type, eventId, timestamp } = parsed.data;
  const attempts = await dispatchAlertPush(deviceId, {
    type,
    deviceId,
    eventId,
    timestamp,
  });
  return NextResponse.json({ ok: true, attempts });
}
