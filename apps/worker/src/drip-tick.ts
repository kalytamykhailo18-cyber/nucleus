import { env } from './env';

/**
 * Drip-email tick — POSTs to nucleus-web's /api/jobs/drip-tick over
 * the docker-compose network. The web service runs the actual query +
 * dispatch loop; the worker is just the long-lived scheduler.
 *
 * Cadence: ten minutes. The DripEmailLog @@unique constraint protects
 * against duplicate sends if a tick races a previous one that is still
 * running, so it is fine to fire-and-forget.
 *
 * Silent if E2E_HOOKS_SECRET is unset (the route 404s in that mode,
 * which is intentional in dev/staging) — we just log and move on.
 */

const TICK_INTERVAL_MS = 10 * 60 * 1000;
const TICK_URL = 'http://nucleus-web:3000/api/jobs/drip-tick';

export interface DripTickLogger {
  info: (msg: string, extra?: Record<string, unknown>) => void;
  warn: (msg: string, extra?: Record<string, unknown>) => void;
  error: (msg: string, extra?: Record<string, unknown>) => void;
}

export function startDripTick(log: DripTickLogger): NodeJS.Timeout | null {
  const secret = env.E2E_HOOKS_SECRET;
  if (!secret) {
    log.info('drip-tick: E2E_HOOKS_SECRET unset, scheduler disabled');
    return null;
  }

  async function runOnce(): Promise<void> {
    try {
      const res = await fetch(TICK_URL, {
        method: 'POST',
        headers: { 'x-e2e-hook-secret': secret! },
      });
      if (!res.ok) {
        log.warn('drip-tick: non-OK response', {
          status: res.status,
          statusText: res.statusText,
        });
        return;
      }
      const body = (await res.json()) as {
        abandonedCart?: number;
        postPurchaseDay7?: number;
        errors?: number;
      };
      const sent =
        (body.abandonedCart ?? 0) + (body.postPurchaseDay7 ?? 0);
      if (sent > 0 || (body.errors ?? 0) > 0) {
        log.info('drip-tick: sent', body);
      }
    } catch (err) {
      log.error('drip-tick: fetch failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Fire once 30 seconds after boot so the worker has time to come up
  // and the web service is reachable; then settle into the regular
  // ten-minute cadence.
  const bootTimer = setTimeout(() => {
    void runOnce();
  }, 30_000);
  const interval = setInterval(() => void runOnce(), TICK_INTERVAL_MS);
  // Return the interval handle so the caller can clearInterval on
  // shutdown; the boot timer self-clears after firing.
  bootTimer.unref();
  return interval;
}
