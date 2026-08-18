import crypto from 'node:crypto';
import { prisma } from '@/lib/db';

/**
 * Customer-facing referral helpers (Phase A+ #1, 2026-06-16).
 *
 * Each paying family gets a unique `referralCode` they share. A
 * friend redeeming the code at signup gets a Referral row keyed
 * back to the referrer; once the friend's Subscription flips ACTIVE
 * (via Stripe webhook) we move the row to REDEEMED and bump
 * `User.referralCreditCentavos` so the credit lands on the next
 * renewal cycle.
 *
 * Default reward shape — easy to swap if Juan picks a different
 * payout model later:
 *   - referrer earns $500 MXN credit per successful referral
 *   - friend's discount is handled separately by the existing
 *     PromoCode engine if Juan wires a code per referral; for now
 *     the friend gets the standard plan price.
 */

const DEFAULT_REFERRAL_CREDIT_CENTAVOS = 50_000;
const REFERRAL_CODE_SUFFIX_BYTES = 4; // 8 hex chars

/**
 * Build a stable referral code from a user's name + a random suffix.
 * Falls back to "REF-…" when fullName is empty. Strips diacritics +
 * non-letters so the code is safe to paste into URLs and shoutout
 * texts ("MARIA-7A2F9B0C"). Retries on collision (rare with 8 hex
 * chars) up to 5 times before giving up.
 */
export async function ensureReferralCode(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, referralCode: true, fullName: true, email: true },
  });
  if (!user) throw new Error('user_not_found');
  if (user.referralCode) return user.referralCode;

  const seed = (user.fullName?.split(' ')[0] ?? user.email.split('@')[0] ?? 'amigo')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z]/g, '')
    .toUpperCase()
    .slice(0, 12) || 'AMIGO';

  for (let attempt = 0; attempt < 5; attempt++) {
    const suffix = crypto.randomBytes(REFERRAL_CODE_SUFFIX_BYTES).toString('hex').toUpperCase();
    const candidate = `${seed}-${suffix}`;
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { referralCode: candidate },
      });
      return candidate;
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code === 'P2002') continue; // unique-collision, retry
      throw err;
    }
  }
  throw new Error('referral_code_generation_exhausted');
}

export interface ReferralPanelRow {
  id: string;
  referredEmail: string;
  referredFullName: string | null;
  status: 'PENDING' | 'REDEEMED' | 'EXPIRED';
  creditCentavos: number;
  createdAt: string;
  redeemedAt: string | null;
}

export interface ReferralPanelData {
  code: string;
  totalCreditCentavos: number;
  pendingCount: number;
  redeemedCount: number;
  referrals: ReferralPanelRow[];
  shareUrl: string;
}

export async function fetchReferralPanel(args: {
  userId: string;
  baseUrl: string;
}): Promise<ReferralPanelData> {
  const code = await ensureReferralCode(args.userId);
  const rows = await prisma.referral.findMany({
    where: { referrerUserId: args.userId },
    orderBy: { createdAt: 'desc' },
    include: {
      referred: { select: { email: true, fullName: true } },
    },
  });
  const me = await prisma.user.findUnique({
    where: { id: args.userId },
    select: { referralCreditCentavos: true },
  });
  return {
    code,
    totalCreditCentavos: me?.referralCreditCentavos ?? 0,
    pendingCount: rows.filter((r) => r.status === 'PENDING').length,
    redeemedCount: rows.filter((r) => r.status === 'REDEEMED').length,
    referrals: rows.map((r) => ({
      id: r.id,
      referredEmail: r.referred.email,
      referredFullName: r.referred.fullName,
      status: r.status as 'PENDING' | 'REDEEMED' | 'EXPIRED',
      creditCentavos: r.creditCentavos,
      createdAt: r.createdAt.toISOString(),
      redeemedAt: r.redeemedAt?.toISOString() ?? null,
    })),
    shareUrl: `${args.baseUrl.replace(/\/$/, '')}/signup?ref=${encodeURIComponent(code)}`,
  };
}

/**
 * Look up the referrer User by a referral code. Returns null when
 * the code doesn't match any active customer or matches the
 * requesting user themselves (no self-referrals).
 */
export async function findReferrerByCode(
  code: string,
  excludeUserId: string | null,
): Promise<{ id: string; email: string; fullName: string | null } | null> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;
  const referrer = await prisma.user.findUnique({
    where: { referralCode: normalized },
    select: { id: true, email: true, fullName: true },
  });
  if (!referrer) return null;
  if (excludeUserId && referrer.id === excludeUserId) return null;
  return referrer;
}

/**
 * Record the referral attribution at signup-time. The new User has
 * just been created; we attach a PENDING Referral row pointing at
 * the referrer. Idempotent — calling twice for the same referred
 * user is a no-op because Referral.referredUserId is @unique.
 */
export async function recordReferralAttribution(args: {
  referrerUserId: string;
  referredUserId: string;
  code: string;
}): Promise<void> {
  try {
    await prisma.referral.create({
      data: {
        referrerUserId: args.referrerUserId,
        referredUserId: args.referredUserId,
        referralCodeUsed: args.code.toUpperCase(),
        status: 'PENDING',
        creditCentavos: DEFAULT_REFERRAL_CREDIT_CENTAVOS,
      },
    });
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;
    if (code === 'P2002') {
      // Already attributed — no-op.
      return;
    }
    throw err;
  }

  // Welcome email to the referee. Fire-and-forget. Errors are
  // swallowed inside the email helper so a transient Resend hiccup
  // never breaks signup.
  const [referrer, referred] = await Promise.all([
    prisma.user.findUnique({
      where: { id: args.referrerUserId },
      select: { fullName: true },
    }),
    prisma.user.findUnique({
      where: { id: args.referredUserId },
      select: { email: true, fullName: true },
    }),
  ]);
  if (referred?.email) {
    const { sendReferralWelcomeEmail } = await import('@/lib/emails/referral');
    void sendReferralWelcomeEmail({
      to: referred.email,
      referredFullName: referred.fullName,
      referrerFullName: referrer?.fullName ?? null,
      referralCodeUsed: args.code.toUpperCase(),
    });
  }
}

/**
 * Mark a PENDING referral as REDEEMED. Bumps the referrer's
 * referralCreditCentavos atomically. Idempotent — safe to call from
 * a Stripe webhook that may retry.
 */
export async function redeemReferralOnPayment(args: {
  referredUserId: string;
  subscriptionId: string;
}): Promise<void> {
  const redeemed = await prisma.$transaction(async (tx) => {
    const ref = await tx.referral.findUnique({
      where: { referredUserId: args.referredUserId },
    });
    if (!ref) return null;
    if (ref.status === 'REDEEMED') return null;
    if (ref.status === 'EXPIRED') return null;
    await tx.referral.update({
      where: { id: ref.id },
      data: {
        status: 'REDEEMED',
        redeemedAt: new Date(),
        subscriptionId: args.subscriptionId,
      },
    });
    await tx.user.update({
      where: { id: ref.referrerUserId },
      data: {
        referralCreditCentavos: { increment: ref.creditCentavos },
      },
    });
    return { referrerUserId: ref.referrerUserId, creditCentavos: ref.creditCentavos };
  });

  if (!redeemed) return;

  // Referrer-side credit-landed email. Fire-and-forget; the email
  // helper swallows transport errors so a Resend hiccup never fails
  // the Stripe webhook (which would otherwise replay).
  const [referrer, referred] = await Promise.all([
    prisma.user.findUnique({
      where: { id: redeemed.referrerUserId },
      select: { email: true, fullName: true },
    }),
    prisma.user.findUnique({
      where: { id: args.referredUserId },
      select: { fullName: true },
    }),
  ]);
  if (referrer?.email) {
    const { sendReferralRedeemedEmail } = await import('@/lib/emails/referral');
    void sendReferralRedeemedEmail({
      to: referrer.email,
      referrerFullName: referrer.fullName,
      referredFullName: referred?.fullName ?? null,
      creditCentavos: redeemed.creditCentavos,
    });
  }
}

/**
 * Default expiration window for PENDING referrals. A friend who signs
 * up with a referral code but never pays drops to EXPIRED after this
 * many days, freeing the referrer to share the code with someone else
 * and keeping the pending list honest in the admin reporting panel.
 */
export const REFERRAL_EXPIRATION_DAYS = 90;

/**
 * Sweep PENDING referrals older than the expiration window and flip
 * them to EXPIRED. Idempotent — calling it twice changes nothing
 * because the WHERE clause excludes EXPIRED rows. Returns the count
 * so the worker tick + the spec hook can verify the sweep ran.
 *
 * Accepts an optional `olderThanDays` override so the Playwright spec
 * can fast-forward without seeding 90-day-old rows. Production
 * callers omit it and pick up the default.
 */
export async function expirePendingReferrals(options: {
  olderThanDays?: number;
} = {}): Promise<{ expired: number; cutoff: string }> {
  const days = options.olderThanDays ?? REFERRAL_EXPIRATION_DAYS;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const res = await prisma.referral.updateMany({
    where: {
      status: 'PENDING',
      createdAt: { lt: cutoff },
    },
    data: { status: 'EXPIRED' },
  });
  return { expired: res.count, cutoff: cutoff.toISOString() };
}
