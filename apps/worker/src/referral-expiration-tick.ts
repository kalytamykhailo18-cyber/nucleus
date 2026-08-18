import { env } from './env';

/**
 * Referral expiration tick — POSTs to nucleus-web's
 * /api/jobs/referral-expiration-tick once a day. The web service
 * runs `expirePendingReferrals()` which flips PENDING referrals
 * older than 90 days to EXPIRED. The worker is just the long-lived
 * scheduler.
 *
 * Cadence: 24 hours. The sweep is idempotent — the WHERE clause
 * excludes already-EXPIRED rows — so a tick that races a previous
 * one or fires twice on a restart is a no-op the second time.
 *
 * Silent if E2E_HOOKS_SECRET is unset (the route 404s in that mode).
 */

const TICK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const TICK_URL = 'http://nucleus-web:3000/api/jobs/referral-expiration-tick';

export interface ReferralExpirationTickLogger {
  info: (msg: string, extra?: Record<string, unknown>) => void;
  warn: (msg: string, extra?: Record<string, unknown>) => void;
  error: (msg: string, extra?: Record<string, unknown>) => void;
}

export function startReferralExpirationTick(
  log: ReferralExpirationTickLogger,
): NodeJS.Timeout | null {
  const secret = env.E2E_HOOKS_SECRET;
  if (!secret) {
    log.info(
      'referral-expiration-tick: E2E_HOOKS_SECRET unset, scheduler disabled',
    );
    return null;
  }

  async function runOnce(): Promise<void> {
    try {
      const res = await fetch(TICK_URL, {
        method: 'POST',
        headers: { 'x-e2e-hook-secret': secret! },
      });
      if (!res.ok) {
        log.warn('referral-expiration-tick: non-OK response', {
          status: res.status,
          statusText: res.statusText,
        });
        return;
      }
      const body = (await res.json()) as { expired?: number };
      if ((body.expired ?? 0) > 0) {
        log.info('referral-expiration-tick: sweep complete', body);
      }
    } catch (err) {
      log.error('referral-expiration-tick: fetch failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Stagger the boot fire by 90 seconds — after drip-tick (30 s) and
  // stripe-cleanup-tick (60 s) — so the three sweeps do not collide
  // on the same network pipe at startup.
  const bootTimer = setTimeout(() => {
    void runOnce();
  }, 90_000);
  const interval = setInterval(() => void runOnce(), TICK_INTERVAL_MS);
  bootTimer.unref();
  return interval;
}
