import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { stripe } from '@/lib/stripe';
import { requireAdmin } from '@/lib/admin';
import { logAdminAction } from '@/lib/admin-audit';

/**
 * POST /api/admin/subscriptions/[id]/refund
 *
 * Refund a charge for an existing subscription without leaving Nucleus.
 * Looks up the latest succeeded PaymentIntent on the customer and
 * refunds it via Stripe — full refund when no `amountCentavos` is
 * supplied, partial when it is. Every refund logs to AdminAuditLog so
 * we know who fired it, on which subscription, and for how much.
 *
 * The Stripe call uses the platform key; we never expose it client-
 * side. Reason is required so the call-center has to justify each
 * refund in the audit log.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  amountCentavos: z.number().int().positive().optional(),
  reason: z.string().min(1).max(500),
  paymentIntentId: z.string().min(1),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const admin = await requireAdmin();
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid' }, { status: 422 });
  }

  const sub = await prisma.subscription.findUnique({
    where: { id },
    select: { id: true, userId: true, user: { select: { email: true } } },
  });
  if (!sub) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  let refund;
  try {
    refund = await stripe().refunds.create({
      payment_intent: parsed.data.paymentIntentId,
      amount: parsed.data.amountCentavos,
      reason: 'requested_by_customer',
      metadata: {
        nucleusSubscriptionId: sub.id,
        nucleusAdminId: admin.id,
        nucleusReason: parsed.data.reason.slice(0, 480),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: 'stripe_refund_failed', message: msg },
      { status: 502 },
    );
  }

  void logAdminAction({
    actorUserId: admin.id,
    actorEmail: admin.email,
    action: 'subscription.refund',
    targetType: 'Subscription',
    targetId: sub.id,
    metadata: {
      paymentIntentId: parsed.data.paymentIntentId,
      amountCentavos: parsed.data.amountCentavos ?? null,
      reason: parsed.data.reason,
      refundId: refund.id,
      stripeStatus: refund.status,
      customerEmail: sub.user.email,
    },
  });

  return NextResponse.json({
    ok: true,
    refundId: refund.id,
    status: refund.status,
    amountCentavos: refund.amount,
  });
}
