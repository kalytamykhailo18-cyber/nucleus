import { NextResponse } from 'next/server';
import { requireFamilyApiAuth } from '@/lib/admin';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { stripe } from '@/lib/stripe';

/**
 * POST /api/billing-portal/create
 *
 * Mints a Stripe-hosted Customer Portal session for the signed-in
 * buyer and returns its URL. The /dashboard "Administrar suscripción"
 * button redirects to this URL; the customer manages card / invoices
 * / cancel there and is bounced back to /dashboard when done.
 *
 * The Stripe Customer is created lazily on first portal access if the
 * User row does not already carry a stripeCustomerId. Pre-cutover
 * PaymentIntents were minted without a customer attached, so the
 * Portal will show future invoices but not the historical one — that
 * is an acceptable trade for v1; new signups going forward should
 * attach the customer at /api/checkout/start time so the Portal sees
 * the full history from day one.
 */
export const dynamic = 'force-dynamic';

export async function POST(): Promise<NextResponse> {
  const gate = await requireFamilyApiAuth();
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });
  const userId = gate.userId;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, fullName: true, stripeCustomerId: true },
  });
  if (!user) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe().customers.create({
      email: user.email,
      name: user.fullName ?? undefined,
      metadata: { nucleusUserId: user.id },
    });
    customerId = customer.id;
    await prisma.user.update({
      where: { id: user.id },
      data: { stripeCustomerId: customerId },
    });
  }

  const returnUrl = `${env.AUTH_URL.replace(/\/$/, '')}/dashboard`;
  const portal = await stripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return NextResponse.json({ url: portal.url });
}
