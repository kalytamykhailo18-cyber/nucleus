import { env } from './env';

/**
 * Stripe Incompleto sweep tick (Juan 2026-06-11).
 *
 * POSTs to nucleus-web's /api/jobs/stripe-cleanup-tick once an hour.
 * The web side does the actual Stripe API work (list → filter → cancel
 * intents older than 24 h that carry the `nucleusSubscriptionId`
 * metadata marker). Keeps Juan's default Pagos view free of dead
 * "Incompleto" rows.
 *
 * Silent if E2E_HOOKS_SECRET is unset (the route 404s in that mode,
 * which is intentional in dev / staging) — we log once and move on.
 */

const TICK_INTERVAL_MS = 60 * 60 * 1000;
const BOOT_DELAY_MS = 2 * 60 * 1000;
const TICK_URL = 'http://nucleus-web:3000/api/jobs/stripe-cleanup-tick';

export interface StripeCleanupTickLogger {
  info: (msg: string, extra?: Record<string, unknown>) => void;
  warn: (msg: string, extra?: Record<string, unknown>) => void;
  error: (msg: string, extra?: Record<string, unknown>) => void;
}

export function startStripeCleanupTick(
  log: StripeCleanupTickLogger,
): NodeJS.Timeout | null {
  const secret = env.E2E_HOOKS_SECRET;
  if (!secret) {
    log.info('stripe-cleanup-tick: E2E_HOOKS_SECRET unset, scheduler disabled');
    return null;
  }

  async function runOnce(): Promise<void> {
    try {
      const res = await fetch(TICK_URL, {
        method: 'POST',
        headers: { 'x-e2e-hook-secret': secret! },
      });
      if (!res.ok) {
        log.warn('stripe-cleanup-tick: non-OK response', {
          status: res.status,
          statusText: res.statusText,
        });
        return;
      }
      const body = (await res.json()) as {
        canceled?: number;
        inspected?: number;
        errors?: number;
      };
      if ((body.canceled ?? 0) > 0 || (body.errors ?? 0) > 0) {
        log.info('stripe-cleanup-tick: swept', body);
      }
    } catch (err) {
      log.error('stripe-cleanup-tick: fetch failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Stagger after boot so we don't pile onto the drip-tick's 30-second
  // first run, and so the web service is fully reachable.
  const bootTimer = setTimeout(() => {
    void runOnce();
  }, BOOT_DELAY_MS);
  const interval = setInterval(() => void runOnce(), TICK_INTERVAL_MS);
  bootTimer.unref();
  return interval;
}
