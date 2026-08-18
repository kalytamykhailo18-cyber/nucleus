import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { stripe } from '@/lib/stripe';
import { nextRenewalAt, type BillingCadence } from '@/lib/plans';
import { sendPaymentConfirmationEmail } from '@/lib/emails/payment-confirmation';

/**
 * Synchronous activation endpoint called by the browser right after
 * Stripe's `confirmPayment` resolves with `succeeded`. We re-verify
 * with Stripe (don't trust the client) and flip the Subscription to
 * ACTIVE if the PaymentIntent really succeeded.
 *
 * The Stripe webhook does the same thing if the user's tab dies
 * mid-confirm. Both paths are idempotent — the Subscription only ever
 * moves PENDING_PAYMENT → ACTIVE here.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  subscriptionId: z.string().min(1).max(64),
});

export async function POST(request: NextRequest) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed' }, { status: 422 });
  }

  const subscription = await prisma.subscription.findUnique({
    where: { id: parsed.data.subscriptionId },
    select: { id: true, userId: true, status: true, stripePaymentIntentId: true, cadence: true },
  });
  if (!subscription) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (subscription.status === 'ACTIVE') {
    return NextResponse.json({ ok: true, alreadyActive: true });
  }
  if (!subscription.stripePaymentIntentId) {
    return NextResponse.json({ error: 'No PaymentIntent attached' }, { status: 409 });
  }

  // Verify with Stripe rather than trusting the client.
  const intent = await stripe().paymentIntents.retrieve(subscription.stripePaymentIntentId);
  if (intent.status !== 'succeeded') {
    return NextResponse.json(
      { error: 'Payment not succeeded yet', stripeStatus: intent.status },
      { status: 409 },
    );
  }

  // updateMany so we can detect whether THIS request flipped the row
  // from PENDING_PAYMENT → ACTIVE. If the webhook beat us to it the
  // count is 0 and we skip the email — the webhook already sent it.
  const now = new Date();
  const renewalAt = subscription.cadence
    ? nextRenewalAt(now, subscription.cadence as BillingCadence)
    : null;
  const flipped = await prisma.subscription.updateMany({
    where: { id: subscription.id, status: 'PENDING_PAYMENT' },
    data: {
      status: 'ACTIVE',
      startDate: now,
      purchaseDate: now,
      currentPhase: 1,
      ...(renewalAt ? { currentPeriodEnd: renewalAt } : {}),
    },
  });
  if (flipped.count > 0) {
    void sendPaymentConfirmationEmail(subscription.id);
    // Customer-facing referral redemption (Phase A+ #1). If the user
    // signed up via a referral code, their PENDING Referral row now
    // moves to REDEEMED and the referrer accrues account credit.
    // Idempotent — safe even when the Stripe webhook also runs.
    const { redeemReferralOnPayment } = await import('@/lib/referrals');
    void redeemReferralOnPayment({
      referredUserId: subscription.userId,
      subscriptionId: subscription.id,
    });
  }

  return NextResponse.json({ ok: true });
}
