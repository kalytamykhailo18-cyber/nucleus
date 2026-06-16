import { NextResponse, type NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { env } from '@/lib/env';
import { stripe } from '@/lib/stripe';

/**
 * Stripe Incompleto sweep (Juan 2026-06-11).
 *
 * Cancels every PaymentIntent that:
 *   - was created more than 24 h ago,
 *   - is still in one of the unconfirmed states (`requires_payment_method`,
 *     `requires_confirmation`, `requires_action`), AND
 *   - carries the `nucleusSubscriptionId` metadata tag (our marker that
 *     this intent came from /api/checkout/start).
 *
 * Canceled PaymentIntents drop off the default Stripe Pagos view so the
 * dispatcher's dashboard stays focused on real, in-flight payments.
 * Cancel reason is `abandoned`, which Stripe surfaces as such on the
 * audit trail for the few rows the dispatcher does click through.
 *
 * Cadence: hourly, fired by the nucleus-worker scheduler. Gated by
 * `E2E_HOOKS_SECRET` like the other /api/jobs/* endpoints.
 *
 * Safety:
 *   - hard cap on intents processed per tick (CANCEL_CAP) so a backlog
 *     never runs for hours,
 *   - only intents carrying `nucleusSubscriptionId` are touched —
 *     anything created via Stripe Dashboard test pings stays untouched,
 *   - cancellation failures are logged + skipped, never thrown, so one
 *     bad row never poisons the rest of the sweep.
 */

export const dynamic = 'force-dynamic';

const LOOKBACK_HOURS = 24;
const CANCEL_CAP = 500;
const PAGE_SIZE = 100;
const CANCELABLE_STATUSES = new Set<Stripe.PaymentIntent.Status>([
  'requires_payment_method',
  'requires_confirmation',
  'requires_action',
]);

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = env.E2E_HOOKS_SECRET;
  if (!secret) {
    return new NextResponse('not found', { status: 404 });
  }
  const provided = request.headers.get('x-e2e-hook-secret');
  if (provided !== secret) {
    return new NextResponse('not found', { status: 404 });
  }

  // Test-only override: the spec creates a fresh PaymentIntent and
  // needs to sweep it without waiting 24 h. Only honored when the
  // secret-header gate has already passed, so production traffic
  // cannot trigger it.
  const overrideRaw = request.nextUrl.searchParams.get('olderThanHours');
  const overrideHours =
    overrideRaw !== null && Number.isFinite(Number(overrideRaw))
      ? Math.max(0, Number(overrideRaw))
      : LOOKBACK_HOURS;
  const cutoffSec = Math.floor(
    (Date.now() - overrideHours * 3_600_000) / 1_000,
  );

  const client = stripe();
  let canceled = 0;
  let inspected = 0;
  let errors = 0;
  let startingAfter: string | undefined;

  while (canceled < CANCEL_CAP) {
    let page: Stripe.ApiList<Stripe.PaymentIntent>;
    try {
      page = await client.paymentIntents.list({
        created: { lt: cutoffSec },
        limit: PAGE_SIZE,
        starting_after: startingAfter,
      });
    } catch (err) {
      console.error('[stripe-cleanup] list page failed', err);
      errors += 1;
      break;
    }
    for (const pi of page.data) {
      inspected += 1;
      if (!pi.metadata?.nucleusSubscriptionId) continue;
      if (!CANCELABLE_STATUSES.has(pi.status)) continue;
      try {
        await client.paymentIntents.cancel(pi.id, {
          cancellation_reason: 'abandoned',
        });
        canceled += 1;
        if (canceled >= CANCEL_CAP) break;
      } catch (err) {
        errors += 1;
        console.error('[stripe-cleanup] cancel failed', {
          intentId: pi.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    if (!page.has_more) break;
    startingAfter = page.data[page.data.length - 1]?.id;
    if (!startingAfter) break;
  }

  return NextResponse.json({
    ok: true,
    canceled,
    inspected,
    errors,
    cap: CANCEL_CAP,
  });
}
