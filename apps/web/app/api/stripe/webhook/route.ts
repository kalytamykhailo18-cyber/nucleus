import { NextResponse, type NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { prisma } from '@/lib/db';
import { stripe } from '@/lib/stripe';
import { env } from '@/lib/env';
import { nextRenewalAt, type BillingCadence } from '@/lib/plans';
import { sendPaymentConfirmationEmail } from '@/lib/emails/payment-confirmation';
import { provisionFromAssistedSalePayment } from '@/lib/assisted-sales';

/**
 * Stripe webhook receiver. Backup path for `payment_intent.succeeded`
 * — the synchronous /api/checkout/finalize call already handles the
 * happy case, but if the user's tab dies between Stripe confirming the
 * charge and our finalize call, this webhook flips the Subscription
 * ACTIVE so the account isn't left dangling.
 *
 * Idempotent: same event firing twice produces the same end state.
 */
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const sig = request.headers.get('stripe-signature');
  if (!sig) {
    return NextResponse.json({ error: 'missing signature' }, { status: 400 });
  }

  // Stripe's verify needs the raw body, not the parsed JSON.
  const raw = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(raw, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return NextResponse.json(
      { error: 'invalid signature', detail: (err as Error).message },
      { status: 400 },
    );
  }

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const intent = event.data.object;
      // Assisted-sales rail (WhatsApp Payment Link) — these intents
      // arrive WITHOUT a `nucleusSubscriptionId` because the User and
      // Subscription rows are minted right here from the link
      // metadata. The helper is idempotent and short-circuits if the
      // webhook is retried.
      if (intent.metadata?.assistedSale === 'true') {
        if (env.NUCLEUS_ASSISTED_SALES_ENABLED) {
          try {
            await provisionFromAssistedSalePayment({
              id: intent.id,
              customer:
                typeof intent.customer === 'string' ? intent.customer : null,
              metadata: intent.metadata as Record<string, string | undefined>,
              amount_received: intent.amount_received,
            });
          } catch (err) {
            console.error(
              '[assisted-sales] provisioning failed for intent',
              intent.id,
              err,
            );
          }
        } else {
          console.warn(
            '[assisted-sales] received intent with assistedSale=true but NUCLEUS_ASSISTED_SALES_ENABLED is off — ignoring',
            intent.id,
          );
        }
        break;
      }
      const subscriptionId = intent.metadata?.nucleusSubscriptionId;
      if (!subscriptionId) break;
      const sub = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
        select: { cadence: true, userId: true },
      });
      const now = new Date();
      // Plan-picker Option B (single $10,117 PaymentIntent in 6 MSI)
      // covers months 1-12 upfront. Cadence on the row is MONTHLY so
      // the renewal worker bills the normal $638 monthly from then on,
      // but the FIRST renewal tick must fire at month 13 — advance
      // currentPeriodEnd by 12 months at activation instead of the
      // default 1 month derived from cadence.
      const isPlanB = intent.metadata?.pickerOption === 'B';
      // Pricing-split (Juan / commercial director 2026-06-19): when
      // /api/checkout/start drops the first month from the upfront
      // charge, it passes `firstMonthChargeDelayDays` through the
      // intent metadata. The webhook then plants currentPeriodEnd N
      // days from now so the renewal worker fires the first $638
      // cycle on schedule. The standard monthly cadence resumes from
      // cycle two onwards via nextRenewalAt.
      const delayDaysRaw = intent.metadata?.firstMonthChargeDelayDays;
      const delayDays = delayDaysRaw ? parseInt(delayDaysRaw, 10) : NaN;
      const pricingSplit =
        Number.isFinite(delayDays) && delayDays > 0 && delayDays < 30;
      let renewalAt: Date | null = null;
      if (pricingSplit) {
        renewalAt = new Date(now);
        renewalAt.setDate(renewalAt.getDate() + delayDays);
      } else if (isPlanB) {
        renewalAt = new Date(now);
        renewalAt.setMonth(renewalAt.getMonth() + 12);
      } else if (sub?.cadence) {
        renewalAt = nextRenewalAt(now, sub.cadence as BillingCadence);
      }
      const flipped = await prisma.subscription.updateMany({
        where: { id: subscriptionId, status: 'PENDING_PAYMENT' },
        data: {
          status: 'ACTIVE',
          startDate: now,
          purchaseDate: now,
          currentPhase: 1,
          ...(renewalAt ? { currentPeriodEnd: renewalAt } : {}),
        },
      });
      // Only send the confirmation when WE flipped the row from
      // PENDING_PAYMENT → ACTIVE here. If updateMany returned 0 rows,
      // the finalize endpoint (or a prior webhook delivery) already
      // activated the subscription and sent the email.
      if (flipped.count > 0) {
        void sendPaymentConfirmationEmail(subscriptionId);
        // Customer-facing referral redemption (Phase A+ #1).
        // Idempotent — `redeemReferralOnPayment` is a no-op if no
        // PENDING row exists or if it's already REDEEMED.
        if (sub?.userId) {
          const { redeemReferralOnPayment } = await import('@/lib/referrals');
          void redeemReferralOnPayment({
            referredUserId: sub.userId,
            subscriptionId,
          });
        }
      }
      break;
    }
    case 'payment_intent.payment_failed': {
      const intent = event.data.object;
      const subscriptionId = intent.metadata?.nucleusSubscriptionId;
      if (!subscriptionId) break;
      // Leave the Subscription in PENDING_PAYMENT — the user can retry
      // by re-submitting checkout. We don't delete because the PII is
      // already saved and useful for support follow-up.
      break;
    }
    default:
      // Ignore other event types — they aren't relevant to checkout.
      break;
  }

  return NextResponse.json({ received: true });
}
