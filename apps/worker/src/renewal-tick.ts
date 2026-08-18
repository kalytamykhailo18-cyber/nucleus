import { env } from './env';

/**
 * Renewal tick — POSTs to nucleus-web's /api/jobs/renewal-tick once an
 * hour. Web-side runs the three phases (reminders, charges, grace
 * expiry). Worker is just the long-lived scheduler.
 *
 * Cadence: 1 hour. Every individual phase is idempotent at the DB
 * level so a tick that fires twice in the same minute is a no-op the
 * second time. Stagger the boot fire by 120 s so it doesn't compete
 * with drip-tick (30 s), stripe-cleanup-tick (60 s), or
 * referral-expiration-tick (90 s) at startup.
 *
 * Silent if E2E_HOOKS_SECRET is unset (the route 404s in that mode).
 */

const TICK_INTERVAL_MS = 60 * 60 * 1000;
const TICK_URL = 'http://nucleus-web:3000/api/jobs/renewal-tick';

export interface RenewalTickLogger {
  info: (msg: string, extra?: Record<string, unknown>) => void;
  warn: (msg: string, extra?: Record<string, unknown>) => void;
  error: (msg: string, extra?: Record<string, unknown>) => void;
}

export function startRenewalTick(
  log: RenewalTickLogger,
): NodeJS.Timeout | null {
  const secret = env.E2E_HOOKS_SECRET;
  if (!secret) {
    log.info('renewal-tick: E2E_HOOKS_SECRET unset, scheduler disabled');
    return null;
  }

  async function runOnce(): Promise<void> {
    try {
      const res = await fetch(TICK_URL, {
        method: 'POST',
        headers: { 'x-e2e-hook-secret': secret! },
      });
      if (!res.ok) {
        log.warn('renewal-tick: non-OK response', {
          status: res.status,
          statusText: res.statusText,
        });
        return;
      }
      const body = (await res.json()) as {
        remindersSent?: number;
        chargesAttempted?: number;
        chargesSucceeded?: number;
        chargesFailed?: number;
        pastDuePromoted?: number;
        cancelled?: number;
        errors?: number;
      };
      const activity =
        (body.remindersSent ?? 0) +
        (body.chargesAttempted ?? 0) +
        (body.pastDuePromoted ?? 0) +
        (body.cancelled ?? 0) +
        (body.errors ?? 0);
      if (activity > 0) {
        log.info('renewal-tick: cycle complete', body);
      }
    } catch (err) {
      log.error('renewal-tick: fetch failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const bootTimer = setTimeout(() => {
    void runOnce();
  }, 120_000);
  const interval = setInterval(() => void runOnce(), TICK_INTERVAL_MS);
  bootTimer.unref();
  return interval;
}
