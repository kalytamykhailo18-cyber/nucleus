import { prisma } from '@/lib/db';
import { sendAbandonedCartEmail } from '@/lib/emails/abandoned-cart';
import { sendPostPurchaseDay3Email } from '@/lib/emails/post-purchase-day3';
import { sendPostPurchaseCheckinEmail } from '@/lib/emails/post-purchase-checkin';
import { sendPostPurchaseDay30Email } from '@/lib/emails/post-purchase-day30';
import { sendDeviceInactive7dEmail } from '@/lib/emails/device-inactive-7d';

/**
 * Drip-email tick — runs from the nucleus-worker process every ten
 * minutes (see apps/worker/src/drip-tick.ts) and also from
 * /api/dev/run-drip-tick during E2E. Idempotent: the DripEmailLog
 * @@unique([subscriptionId, kind]) constraint prevents double-sends
 * even if two ticks race, so the runner just attempts the insert and
 * skips the send on conflict.
 *
 * Five beats today:
 *   - ABANDONED_CART      — Subscription PENDING_PAYMENT for >24h
 *   - POST_PURCHASE_DAY3  — Subscription ACTIVE, activatedAt 3-5d ago
 *   - POST_PURCHASE_DAY7  — Subscription ACTIVE, activatedAt 7-14d ago
 *                           (catches anything missed during the grace
 *                           window in case the worker was down)
 *   - POST_PURCHASE_DAY30 — Subscription ACTIVE, activatedAt 30-37d ago
 *   - DEVICE_INACTIVE_7D  — Subscription ACTIVE, paired device has not
 *                           reported an EviewEvent in seven days
 */

const ABANDONED_CART_AGE_HOURS = 24;
const POST_PURCHASE_DAY3_MIN_AGE_DAYS = 3;
const POST_PURCHASE_DAY3_MAX_AGE_DAYS = 5;
const POST_PURCHASE_DAY7_MIN_AGE_DAYS = 7;
const POST_PURCHASE_DAY7_MAX_AGE_DAYS = 14;
const POST_PURCHASE_DAY30_MIN_AGE_DAYS = 30;
const POST_PURCHASE_DAY30_MAX_AGE_DAYS = 37;
const DEVICE_INACTIVE_DAYS = 7;

/**
 * Postgres throws 22P02 ("invalid_text_representation") when a query
 * references an enum value the DB does not know yet. That happens
 * during the window between this code shipping and `prisma db push`
 * landing the new DripEmailKind values on the prod DB. Treat it as a
 * known not-yet-migrated condition so the tick reports a clean
 * `errors: 0` instead of false-alarming until the migration runs.
 */
function isUnmigratedEnumError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const msg = (err as { message?: string }).message ?? '';
  return /invalid input value for enum/i.test(msg) && /DripEmailKind/i.test(msg);
}

export interface DripTickResult {
  abandonedCart: number;
  postPurchaseDay3: number;
  postPurchaseDay7: number;
  postPurchaseDay30: number;
  deviceInactive7d: number;
  errors: number;
}

export async function runDripEmailTick(): Promise<DripTickResult> {
  const result: DripTickResult = {
    abandonedCart: 0,
    postPurchaseDay3: 0,
    postPurchaseDay7: 0,
    postPurchaseDay30: 0,
    deviceInactive7d: 0,
    errors: 0,
  };

  const now = Date.now();
  const abandonCutoff = new Date(now - ABANDONED_CART_AGE_HOURS * 3_600_000);
  const dayMs = 24 * 3_600_000;
  const day3MinCutoff = new Date(now - POST_PURCHASE_DAY3_MAX_AGE_DAYS * dayMs);
  const day3MaxCutoff = new Date(now - POST_PURCHASE_DAY3_MIN_AGE_DAYS * dayMs);
  const postMinCutoff = new Date(now - POST_PURCHASE_DAY7_MAX_AGE_DAYS * dayMs);
  const postMaxCutoff = new Date(now - POST_PURCHASE_DAY7_MIN_AGE_DAYS * dayMs);
  const day30MinCutoff = new Date(now - POST_PURCHASE_DAY30_MAX_AGE_DAYS * dayMs);
  const day30MaxCutoff = new Date(now - POST_PURCHASE_DAY30_MIN_AGE_DAYS * dayMs);
  const inactiveCutoff = new Date(now - DEVICE_INACTIVE_DAYS * dayMs);

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

  // --- POST_PURCHASE_DAY3 -----------------------------------------------
  // Outer try/catch isolates this beat from the rest of the tick. If
  // the DripEmailKind enum on the live DB lacks this value (pending
  // `prisma db push` after Juan 2026-06-26 enum addition), Postgres
  // throws 22P02 on the where clause and would otherwise kill the
  // whole tick. Wrapping makes the failure observable but contained.
  try {
    const day3 = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        activatedAt: { gte: day3MinCutoff, lt: day3MaxCutoff },
        dripEmails: { none: { kind: 'POST_PURCHASE_DAY3' } },
      },
      orderBy: { activatedAt: 'desc' },
      select: { id: true },
      take: 50,
    });
    for (const s of day3) {
      try {
        await prisma.dripEmailLog.create({
          data: { subscriptionId: s.id, kind: 'POST_PURCHASE_DAY3' },
        });
        await sendPostPurchaseDay3Email(s.id);
        result.postPurchaseDay3 += 1;
      } catch (err) {
        const code = (err as { code?: string } | null)?.code;
        if (code !== 'P2002') {
          result.errors += 1;
          console.error('[drip-tick] POST_PURCHASE_DAY3 send failed', s.id, err);
        }
      }
    }
  } catch (err) {
    // Postgres 22P02 = invalid input value for enum (the prod DB has
    // not yet had `prisma db push` run for the new DripEmailKind
    // values added 2026-06-26). Treat as a known not-yet-migrated
    // condition rather than a real error — once the push lands, this
    // catch never fires again and the beat is live.
    if (!isUnmigratedEnumError(err)) {
      result.errors += 1;
      console.error('[drip-tick] POST_PURCHASE_DAY3 beat skipped', err);
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

  // --- POST_PURCHASE_DAY30 ----------------------------------------------
  // Outer try/catch isolates this beat (see POST_PURCHASE_DAY3 above).
  try {
    const day30 = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        activatedAt: { gte: day30MinCutoff, lt: day30MaxCutoff },
        dripEmails: { none: { kind: 'POST_PURCHASE_DAY30' } },
      },
      orderBy: { activatedAt: 'desc' },
      select: { id: true },
      take: 50,
    });
    for (const s of day30) {
      try {
        await prisma.dripEmailLog.create({
          data: { subscriptionId: s.id, kind: 'POST_PURCHASE_DAY30' },
        });
        await sendPostPurchaseDay30Email(s.id);
        result.postPurchaseDay30 += 1;
      } catch (err) {
        const code = (err as { code?: string } | null)?.code;
        if (code !== 'P2002') {
          result.errors += 1;
          console.error('[drip-tick] POST_PURCHASE_DAY30 send failed', s.id, err);
        }
      }
    }
  } catch (err) {
    if (!isUnmigratedEnumError(err)) {
      result.errors += 1;
      console.error('[drip-tick] POST_PURCHASE_DAY30 beat skipped', err);
    }
  }

  // --- DEVICE_INACTIVE_7D -----------------------------------------------
  // Two-stage filter to keep the query cheap on a large fleet:
  //   1. Find ACTIVE subs that haven't been emailed yet AND have at
  //      least one paired UserDevice.
  //   2. For each, check the user's primary device's most recent event
  //      against the seven-day cutoff. Devices with zero events ever
  //      are also flagged (could be a never-activated unit).
  // Outer try/catch isolates the beat from the rest of the tick.
  try {
    const inactiveCandidates = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        activatedAt: { not: null, lt: inactiveCutoff },
        dripEmails: { none: { kind: 'DEVICE_INACTIVE_7D' } },
        user: { devices: { some: {} } },
      },
      orderBy: { activatedAt: 'desc' },
      select: {
        id: true,
        user: {
          select: { devices: { select: { eviewDeviceId: true }, take: 1 } },
        },
      },
      take: 50,
    });
    for (const s of inactiveCandidates) {
      const deviceId = s.user.devices[0]?.eviewDeviceId;
      if (!deviceId) continue;
      const latest = await prisma.eviewEvent.findFirst({
        where: { eviewDeviceId: deviceId },
        orderBy: { timestamp: 'desc' },
        select: { timestamp: true },
      });
      if (latest && latest.timestamp >= inactiveCutoff) continue;
      try {
        await prisma.dripEmailLog.create({
          data: { subscriptionId: s.id, kind: 'DEVICE_INACTIVE_7D' },
        });
        await sendDeviceInactive7dEmail(s.id);
        result.deviceInactive7d += 1;
      } catch (err) {
        const code = (err as { code?: string } | null)?.code;
        if (code !== 'P2002') {
          result.errors += 1;
          console.error('[drip-tick] DEVICE_INACTIVE_7D send failed', s.id, err);
        }
      }
    }
  } catch (err) {
    if (!isUnmigratedEnumError(err)) {
      result.errors += 1;
      console.error('[drip-tick] DEVICE_INACTIVE_7D beat skipped', err);
    }
  }

  return result;
}
