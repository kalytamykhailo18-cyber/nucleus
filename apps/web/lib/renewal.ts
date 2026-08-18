import { prisma } from '@/lib/db';
import { stripe } from '@/lib/stripe';
import {
  nextRenewalAt,
  cadenceLabel,
  grossCentsForNet,
  type BillingCadence,
} from '@/lib/plans';
import { sendRenewalReminderEmail } from '@/lib/emails/renewal-reminder';
import { sendRenewalSuccessEmail } from '@/lib/emails/renewal-success';
import { sendRenewalFailedEmail } from '@/lib/emails/renewal-failed';
import { logAdminAction } from '@/lib/admin-audit';

/**
 * Renewal worker (Juan 2026-06-18). Three phases per tick:
 *
 *   1. **Send reminders** — every ACTIVE subscription whose
 *      `currentPeriodEnd` lands inside the next 7 days AND has not
 *      yet had its reminder sent gets a "Tu Sensu se renueva el ..."
 *      email. The `renewalReminderSentAt` column gates idempotency.
 *
 *   2. **Attempt charges** — every ACTIVE subscription past
 *      `currentPeriodEnd` (and not over the retry cap) gets an
 *      off-session PaymentIntent against the customer's saved card.
 *      Success: advance `currentPeriodEnd` by one cadence, reset
 *      the reminder + attempt counters, send the success email.
 *      Failure: increment `renewalAttemptCount`, send the
 *      "renewal-failed/attempt" dunning email.
 *
 *   3. **Promote PAST_DUE and CANCEL** — subscriptions that hit
 *      `RETRY_CAP` consecutive failures flip to PAST_DUE with a
 *      `GRACE_PERIOD_DAYS`-long window for the customer to update
 *      their card. PAST_DUE rows past their grace date auto-flip
 *      to CANCELLED. Both transitions email the customer.
 *
 * The tick is idempotent: re-running it in the same hour processes
 * nothing new because the columns it advances (currentPeriodEnd,
 * renewalAttemptCount, status) gate every query above.
 *
 * Pure functions, no HTTP. Caller is `/api/jobs/renewal-tick`.
 */

const REMINDER_WINDOW_DAYS = 7;
const RETRY_CAP = 4;
const GRACE_PERIOD_DAYS = 14;

export interface RenewalTickResult {
  remindersSent: number;
  remindersSkipped: number;
  chargesAttempted: number;
  chargesSucceeded: number;
  chargesFailed: number;
  pastDuePromoted: number;
  cancelled: number;
  errors: number;
}

export async function runRenewalTick(options: {
  /** Test-only override that fast-forwards the reminder window. The
   *  spec passes 0 to assert reminder-send logic without seeding
   *  7-day-out rows. Production callers omit it. */
  overrideReminderWindowDays?: number;
} = {}): Promise<RenewalTickResult> {
  const reminderWindowDays = options.overrideReminderWindowDays ?? REMINDER_WINDOW_DAYS;
  const result: RenewalTickResult = {
    remindersSent: 0,
    remindersSkipped: 0,
    chargesAttempted: 0,
    chargesSucceeded: 0,
    chargesFailed: 0,
    pastDuePromoted: 0,
    cancelled: 0,
    errors: 0,
  };

  await runReminderPhase(reminderWindowDays, result);
  await runChargePhase(result);
  await runGracePhase(result);

  return result;
}

async function runReminderPhase(
  windowDays: number,
  result: RenewalTickResult,
): Promise<void> {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000);

  const candidates = await prisma.subscription.findMany({
    where: {
      status: 'ACTIVE',
      currentPeriodEnd: { gte: now, lte: windowEnd },
      renewalReminderSentAt: null,
    },
    select: {
      id: true,
      cadence: true,
      amountPaidCentavos: true,
      currentPeriodEnd: true,
      user: { select: { email: true, fullName: true } },
      plan: {
        select: {
          name: true,
          priceMonthlyCents: true,
          priceSemestralCents: true,
          priceAnnualCents: true,
        },
      },
    },
  });

  for (const sub of candidates) {
    if (!sub.user.email || !sub.currentPeriodEnd || !sub.cadence) {
      result.remindersSkipped += 1;
      continue;
    }
    try {
      await sendRenewalReminderEmail({
        to: sub.user.email,
        firstName: firstName(sub.user.fullName),
        amountCentavos: chargeAmount(sub),
        renewalDate: sub.currentPeriodEnd,
        cadenceLabel: cadenceLabel(sub.cadence as BillingCadence),
      });
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { renewalReminderSentAt: now },
      });
      result.remindersSent += 1;
    } catch (err) {
      console.error('[renewal-tick] reminder failed', sub.id, err);
      result.errors += 1;
    }
  }
}

async function runChargePhase(result: RenewalTickResult): Promise<void> {
  const now = new Date();
  const candidates = await prisma.subscription.findMany({
    where: {
      status: 'ACTIVE',
      currentPeriodEnd: { lt: now },
      renewalAttemptCount: { lt: RETRY_CAP },
    },
    select: {
      id: true,
      cadence: true,
      amountPaidCentavos: true,
      currentPeriodEnd: true,
      renewalAttemptCount: true,
      user: {
        select: {
          id: true,
          email: true,
          fullName: true,
          stripeCustomerId: true,
        },
      },
      plan: {
        select: {
          name: true,
          type: true,
          priceMonthlyCents: true,
          priceSemestralCents: true,
          priceAnnualCents: true,
        },
      },
    },
    take: 50,
  });

  for (const sub of candidates) {
    if (!sub.user.email || !sub.cadence || !sub.user.stripeCustomerId) {
      result.errors += 1;
      continue;
    }
    result.chargesAttempted += 1;
    const outcome = await attemptCharge({
      stripeCustomerId: sub.user.stripeCustomerId,
      amountCentavos: chargeAmount(sub),
      subscriptionId: sub.id,
      userId: sub.user.id,
      planType: sub.plan.type,
    });

    if (outcome.kind === 'succeeded') {
      const nextEnd = sub.currentPeriodEnd
        ? nextRenewalAt(sub.currentPeriodEnd, sub.cadence as BillingCadence)
        : nextRenewalAt(now, sub.cadence as BillingCadence);
      await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          currentPeriodEnd: nextEnd,
          renewalReminderSentAt: null,
          renewalAttemptCount: 0,
        },
      });
      await sendRenewalSuccessEmail({
        to: sub.user.email,
        firstName: firstName(sub.user.fullName),
        amountCentavos: outcome.amount,
        nextRenewalDate: nextEnd,
        cadenceLabel: cadenceLabel(sub.cadence as BillingCadence),
      });
      result.chargesSucceeded += 1;
    } else {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          renewalAttemptCount: sub.renewalAttemptCount + 1,
        },
      });
      const isFinalAttempt = sub.renewalAttemptCount + 1 >= RETRY_CAP;
      await sendRenewalFailedEmail({
        to: sub.user.email,
        firstName: firstName(sub.user.fullName),
        amountCentavos: chargeAmount(sub),
        declineReason: outcome.declineReason,
        kind: isFinalAttempt ? 'past_due' : 'attempt',
        nextActionDate: isFinalAttempt
          ? new Date(now.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000)
          : null,
      });
      if (isFinalAttempt) {
        const graceEnd = new Date(
          now.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000,
        );
        await prisma.subscription.update({
          where: { id: sub.id },
          data: {
            status: 'PAST_DUE',
            pastDueGraceEndsAt: graceEnd,
          },
        });
        void logAdminAction({
          actorEmail: 'renewal-worker',
          action: 'subscription.renewal_past_due',
          targetType: 'Subscription',
          targetId: sub.id,
          metadata: {
            attempts: sub.renewalAttemptCount + 1,
            declineReason: outcome.declineReason,
            graceEndsAt: graceEnd.toISOString(),
          },
        });
        result.pastDuePromoted += 1;
      }
      result.chargesFailed += 1;
    }
  }
}

async function runGracePhase(result: RenewalTickResult): Promise<void> {
  const now = new Date();
  const expired = await prisma.subscription.findMany({
    where: {
      status: 'PAST_DUE',
      pastDueGraceEndsAt: { lt: now },
    },
    select: {
      id: true,
      cadence: true,
      amountPaidCentavos: true,
      user: { select: { email: true, fullName: true } },
      plan: {
        select: {
          priceMonthlyCents: true,
          priceSemestralCents: true,
          priceAnnualCents: true,
        },
      },
    },
  });
  for (const sub of expired) {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: 'CANCELLED' },
    });
    if (sub.user.email) {
      await sendRenewalFailedEmail({
        to: sub.user.email,
        firstName: firstName(sub.user.fullName),
        amountCentavos: chargeAmount(sub),
        declineReason: null,
        kind: 'cancelled',
        nextActionDate: null,
      });
    }
    void logAdminAction({
      actorEmail: 'renewal-worker',
      action: 'subscription.auto_cancelled',
      targetType: 'Subscription',
      targetId: sub.id,
      metadata: {
        reason: 'grace_period_expired',
        customerEmail: sub.user.email ?? null,
      },
    });
    result.cancelled += 1;
  }
}

type ChargeOutcome =
  | { kind: 'succeeded'; amount: number; intentId: string }
  | { kind: 'failed'; declineReason: string | null };

async function attemptCharge(args: {
  stripeCustomerId: string;
  amountCentavos: number;
  subscriptionId: string;
  userId: string;
  planType: string;
}): Promise<ChargeOutcome> {
  try {
    const methods = await stripe().paymentMethods.list({
      customer: args.stripeCustomerId,
      type: 'card',
      limit: 5,
    });
    const pm = methods.data[0];
    if (!pm) {
      return { kind: 'failed', declineReason: 'no_payment_method_on_file' };
    }
    const intent = await stripe().paymentIntents.create({
      amount: args.amountCentavos,
      currency: 'mxn',
      customer: args.stripeCustomerId,
      payment_method: pm.id,
      off_session: true,
      confirm: true,
      description: `Renovación Sensu (${args.planType})`,
      metadata: {
        nucleusSubscriptionId: args.subscriptionId,
        nucleusUserId: args.userId,
        planType: args.planType,
        renewal: 'true',
      },
    });
    if (intent.status === 'succeeded') {
      return { kind: 'succeeded', amount: intent.amount, intentId: intent.id };
    }
    return {
      kind: 'failed',
      declineReason: intent.last_payment_error?.message ?? intent.status,
    };
  } catch (err) {
    const stripeErr = err as {
      raw?: { message?: string; code?: string; decline_code?: string };
      message?: string;
    };
    const reason =
      stripeErr.raw?.message ??
      stripeErr.raw?.decline_code ??
      stripeErr.raw?.code ??
      stripeErr.message ??
      'unknown_stripe_error';
    return { kind: 'failed', declineReason: reason };
  }
}

function firstName(fullName: string | null): string | null {
  if (!fullName) return null;
  return fullName.split(' ')[0]?.trim() ?? null;
}

/**
 * Resolve the gross charge for a renewal cycle.
 *
 * The first cycle's `Subscription.amountPaidCentavos` includes the
 * one-time fees (device + activation + shipping + first month
 * service). Using it as the renewal amount would charge the customer
 * $3,599 every month instead of the $638 recurring fee — a silent
 * revenue / dispute time-bomb (Juan 2026-06-19).
 *
 * Correct shape: read the cadence-specific net price off the Plan
 * row and add IVA. The Plan is the source of truth for the recurring
 * shape; the Subscription only tells us what cycle to charge.
 */
function chargeAmount(sub: {
  cadence: string | null;
  plan: {
    priceMonthlyCents: number | null;
    priceSemestralCents: number | null;
    priceAnnualCents: number | null;
  };
  amountPaidCentavos: number | null;
}): number {
  const netByCadence: Record<string, number | null | undefined> = {
    MONTHLY: sub.plan.priceMonthlyCents,
    SEMESTRAL: sub.plan.priceSemestralCents,
    ANNUAL: sub.plan.priceAnnualCents,
  };
  const net = sub.cadence ? netByCadence[sub.cadence] : null;
  if (net && net > 0) return grossCentsForNet(net);

  // Fallback for legacy single-monthly subscriptions from before the
  // 2026-05-26 pricing pivot, where the Plan row may not carry
  // per-cadence prices. amountPaidCentavos on those rows is the
  // recurring chunk alone (one-time fees lived on a separate
  // Subscription row, since cleaned up). Safe to use.
  return sub.amountPaidCentavos ?? 0;
}

export const __renewalConstants = {
  REMINDER_WINDOW_DAYS,
  RETRY_CAP,
  GRACE_PERIOD_DAYS,
};
