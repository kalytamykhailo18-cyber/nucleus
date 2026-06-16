import { NextResponse, type NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { prisma } from '@/lib/db';
import { stripe } from '@/lib/stripe';
import { env } from '@/lib/env';
import { nextRenewalAt, type BillingCadence } from '@/lib/plans';
import { sendPaymentConfirmationEmail } from '@/lib/emails/payment-confirmation';

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
      const subscriptionId = intent.metadata?.nucleusSubscriptionId;
      if (!subscriptionId) break;
      const sub = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
        select: { cadence: true },
      });
      const now = new Date();
      const renewalAt = sub?.cadence
        ? nextRenewalAt(now, sub.cadence as BillingCadence)
        : null;
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
