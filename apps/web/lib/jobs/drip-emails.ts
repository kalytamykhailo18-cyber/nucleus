import { prisma } from '@/lib/db';
import { sendAbandonedCartEmail } from '@/lib/emails/abandoned-cart';
import { sendPostPurchaseCheckinEmail } from '@/lib/emails/post-purchase-checkin';

/**
 * Drip-email tick — runs from the nucleus-worker process every ten
 * minutes (see apps/worker/src/drip-tick.ts) and also from
 * /api/dev/run-drip-tick during E2E. Idempotent: the DripEmailLog
 * @@unique([subscriptionId, kind]) constraint prevents double-sends
 * even if two ticks race, so the runner just attempts the insert and
 * skips the send on conflict.
 *
 * Two beats today (extensible — add another `kind` to the enum and a
 * new helper below):
 *   - ABANDONED_CART      — Subscription PENDING_PAYMENT for >24h
 *   - POST_PURCHASE_DAY7  — Subscription ACTIVE, activatedAt was 7-14d
 *                           ago (catches anything missed during the
 *                           grace window in case the worker was down)
 */

const ABANDONED_CART_AGE_HOURS = 24;
const POST_PURCHASE_DAY7_MIN_AGE_DAYS = 7;
const POST_PURCHASE_DAY7_MAX_AGE_DAYS = 14;

export interface DripTickResult {
  abandonedCart: number;
  postPurchaseDay7: number;
  errors: number;
}

export async function runDripEmailTick(): Promise<DripTickResult> {
  const result: DripTickResult = {
    abandonedCart: 0,
    postPurchaseDay7: 0,
    errors: 0,
  };

  const now = Date.now();
  const abandonCutoff = new Date(now - ABANDONED_CART_AGE_HOURS * 3_600_000);
  const dayMs = 24 * 3_600_000;
  const postMinCutoff = new Date(now - POST_PURCHASE_DAY7_MAX_AGE_DAYS * dayMs);
  const postMaxCutoff = new Date(now - POST_PURCHASE_DAY7_MIN_AGE_DAYS * dayMs);

  // --- ABANDONED_CART ----------------------------------------------------
  // Pending-payment subs older than the cutoff that have no existing
  // ABANDONED_CART log entry. The `dripEmails` filter uses a `none`
  // predicate so Prisma generates a LEFT JOIN + NULL check; same as a
  // raw NOT EXISTS but type-safe.
  const abandoned = await prisma.subscription.findMany({
    where: {
      status: 'PENDING_PAYMENT',
      createdAt: { lt: abandonCutoff },
      dripEmails: { none: { kind: 'ABANDONED_CART' } },
    },
    // Newest-first so the freshest (warmest) abandonments get the
    // nudge before stone-cold legacy rows. With ~700 pre-existing
    // PENDING_PAYMENT subs in the DB from pre-cutover testing, this
    // also keeps the e2e spec deterministic — its just-seeded backdated
    // sub lands on page 1.
    orderBy: { createdAt: 'desc' },
    select: { id: true },
    take: 50,
  });
  for (const s of abandoned) {
    try {
      // Reserve the slot first (unique-constraint protects against
      // races). Only if that succeeds do we send — that way a duplicate
      // tick from a second worker instance bails on the insert and
      // never re-sends.
      await prisma.dripEmailLog.create({
        data: { subscriptionId: s.id, kind: 'ABANDONED_CART' },
      });
      await sendAbandonedCartEmail(s.id);
      result.abandonedCart += 1;
    } catch (err) {
      // P2002 = unique-constraint violation (another tick won the race).
      // Anything else is a real error; surface it but keep ticking.
      const code = (err as { code?: string } | null)?.code;
      if (code !== 'P2002') {
        result.errors += 1;
        console.error('[drip-tick] ABANDONED_CART send failed', s.id, err);
      }
    }
  }

  // --- POST_PURCHASE_DAY7 -----------------------------------------------
  const day7 = await prisma.subscription.findMany({
    where: {
      status: 'ACTIVE',
      activatedAt: { gte: postMinCutoff, lt: postMaxCutoff },
      dripEmails: { none: { kind: 'POST_PURCHASE_DAY7' } },
    },
    // Same DESC ordering as ABANDONED_CART above — newest first.
    orderBy: { activatedAt: 'desc' },
    select: { id: true },
    take: 50,
  });
  for (const s of day7) {
    try {
      await prisma.dripEmailLog.create({
        data: { subscriptionId: s.id, kind: 'POST_PURCHASE_DAY7' },
      });
      await sendPostPurchaseCheckinEmail(s.id);
      result.postPurchaseDay7 += 1;
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code !== 'P2002') {
        result.errors += 1;
        console.error('[drip-tick] POST_PURCHASE_DAY7 send failed', s.id, err);
      }
    }
  }

  return result;
}
