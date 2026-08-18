/**
 * Worker → web push bridge.
 *
 * Historic behaviour (pre 2026-08-07): the worker had its own local
 * dispatcher that only emitted the LEGACY payload shape (no tier, no
 * action buttons, no silent flag) and only fanned to family users —
 * the call-center audience never got pushed on a real MQTT pendant
 * fire. Real pendants therefore missed everything Steps 4-8 added
 * (the "Ya lo estoy investigando" family action, RICH tier + vibrate,
 * silent standard-tier, operator fan-out).
 *
 * New behaviour: the worker POSTs the bare alert descriptor to
 * `/api/jobs/dispatch-alert-push` on nucleus-web, which runs the
 * single canonical `dispatchAlertPush` from `apps/web/lib/push-dispatch.ts`.
 * One dispatcher, one payload contract, one source of truth for
 * family + call-center fanning + missed-push tracking + silent-flag.
 *
 * Best-effort: on HTTP failure or non-200 response we log and return
 * 0 attempts. Alert persistence already happened before this call —
 * the push is the bonus channel.
 */

import type { PrismaClient } from '@prisma/client';
import { env } from './env';

export interface AlertPushPayload {
  type: string;          // 'sos' | 'fall_detection' | ...
  deviceId: string;
  eventId: string;
  timestamp: string;     // ISO 8601
}

const DISPATCH_URL = 'http://nucleus-web:3000/api/jobs/dispatch-alert-push';

function log(level: 'info' | 'warn' | 'error', msg: string, extra: Record<string, unknown> = {}): void {
  const line = { ts: new Date().toISOString(), level, msg, src: 'push', ...extra };
  console.log(JSON.stringify(line));
}

/**
 * Fan out a push to every family + call-center user linked to the
 * device the alert just landed on. Delegates to nucleus-web so the
 * single canonical dispatcher owns RICH payload building, audience
 * fanning, silent-flag logic, outbox capture, and subscription
 * pruning. `prisma` is unused (kept in the signature to preserve
 * the current call site in `index.ts`).
 *
 * Returns the number of dispatch attempts as reported by the web
 * side, or 0 on any error.
 */
export async function dispatchAlertPush(
  _prisma: PrismaClient,
  deviceId: string,
  payload: AlertPushPayload,
): Promise<number> {
  const secret = env.E2E_HOOKS_SECRET;
  if (!secret) {
    log('warn', 'E2E_HOOKS_SECRET missing — cannot dispatch push', { deviceId });
    return 0;
  }
  try {
    const res = await fetch(DISPATCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-e2e-hook-secret': secret,
      },
      body: JSON.stringify({
        deviceId,
        type: payload.type,
        eventId: payload.eventId,
        timestamp: payload.timestamp,
      }),
    });
    if (!res.ok) {
      log('warn', 'dispatch-alert-push returned non-200', {
        status: res.status,
        deviceId,
        eventId: payload.eventId,
      });
      return 0;
    }
    const body = (await res.json()) as { attempts?: number };
    return typeof body.attempts === 'number' ? body.attempts : 0;
  } catch (err) {
    log('error', 'dispatch-alert-push fetch failed', {
      error: err instanceof Error ? err.message : String(err),
      deviceId,
      eventId: payload.eventId,
    });
    return 0;
  }
}
