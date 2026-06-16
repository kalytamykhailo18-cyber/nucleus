import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { stripe } from '@/lib/stripe';
import { fetchActivePlans, type PlanType } from '@/lib/plans';
import { CheckoutForm } from './checkout-form';
import { env } from '@/lib/env';

/**
 * /checkout
 *
 * Three modes:
 *
 *   1. Anonymous visitor (no session): full flow — collect buyer fields,
 *      then mount Stripe Elements for the new Subscription.
 *
 *   2. Authed user with a PENDING_PAYMENT Subscription: "resume" mode —
 *      skip the buyer form, refresh the PaymentIntent on the existing
 *      Subscription, and mount Stripe Elements directly. This is the
 *      path a family takes when they abandoned checkout mid-flow,
 *      logged back in later, and want to finish paying.
 *
 *   3. Authed user with an ACTIVE Subscription: redirect to /dashboard —
 *      they have already paid; no checkout needed.
 */
export const dynamic = 'force-dynamic';

export interface CheckoutPromo {
  code: string;
  label: string;
  percentOffBps: number;
  applyToInitialFee: boolean;
  cadenceLock: 'MONTHLY' | 'SEMESTRAL' | 'ANNUAL' | null;
}

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; promo?: string; cadence?: string; source?: string }>;
}) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id ?? null;

  // Mode 2 + 3: authed user. Look up their latest subscription and route
  // by status.
  let resumeData: {
    clientSecret: string;
    subscriptionId: string;
    planType: PlanType;
  } | null = null;

  if (userId) {
    const latestSub = await prisma.subscription.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        stripePaymentIntentId: true,
        plan: { select: { type: true, monitoringPrice: true, name: true } },
      },
    });

    // Mode 3: authed but not mid-purchase — get off the checkout page.
    // Covers ACTIVE (already paid), PAST_DUE / CANCELLED (lifecycle owns
    // the surface), and authed users who never started a subscription at
    // all (no row at all — admins, bare /signup users). Route by role so
    // admins land on `/` (CMS) and company-admins on `/company`.
    if (!latestSub || latestSub.status !== 'PENDING_PAYMENT') {
      const { resolveLandingPath } = await import('@/lib/post-login-destination');
      const role = (session?.user as { role?: 'USER' | 'ADMIN' } | undefined)?.role ?? null;
      const landing = await resolveLandingPath({ userId, role });
      redirect(landing);
    }

    // Mode 2: refresh the PaymentIntent and pre-mount Stripe Elements.
    {
      // Try to reuse the existing PaymentIntent if it is still in a
      // confirmable state; otherwise create a fresh one. The client
      // secret is the same for the life of the PaymentIntent.
      let clientSecret: string | null = null;
      let intentId = latestSub.stripePaymentIntentId;

      if (intentId) {
        try {
          const intent = await stripe().paymentIntents.retrieve(intentId);
          if (
            intent.status === 'requires_payment_method' ||
            intent.status === 'requires_confirmation' ||
            intent.status === 'requires_action'
          ) {
            clientSecret = intent.client_secret;
          }
        } catch {
          // Intent missing or unreadable — fall through to creating a
          // fresh one below.
          intentId = null;
        }
      }

      if (!clientSecret) {
        const fresh = await stripe().paymentIntents.create({
          amount: latestSub.plan.monitoringPrice,
          currency: 'mxn',
          description: `${latestSub.plan.name} (primer mes, resumido)`,
          receipt_email: session!.user!.email ?? undefined,
          automatic_payment_methods: { enabled: true },
          metadata: {
            nucleusSubscriptionId: latestSub.id,
            nucleusUserId: userId,
            planType: latestSub.plan.type,
            resume: 'true',
          },
        });
        await prisma.subscription.update({
          where: { id: latestSub.id },
          data: { stripePaymentIntentId: fresh.id },
        });
        clientSecret = fresh.client_secret;
      }

      if (clientSecret) {
        resumeData = {
          clientSecret,
          subscriptionId: latestSub.id,
          planType: latestSub.plan.type as PlanType,
        };
      }
    }
  }

  const {
    plan: planParam,
    promo: promoParam,
    cadence: cadenceParam,
    source: sourceParam,
  } = await searchParams;
  const plans = await fetchActivePlans();

  // Partner promo lookup. Only honored on fresh signups (no resumeData)
  // — once a Subscription exists the discount is already persisted on
  // the row and the redeem-on-resume path would double-apply.
  let promo: CheckoutPromo | null = null;
  if (promoParam && !resumeData) {
    const row = await prisma.promoCode.findUnique({
      where: { code: promoParam.trim().toUpperCase() },
    });
    const now = new Date();
    const valid =
      row !== null &&
      (!row.validFrom || row.validFrom <= now) &&
      (!row.validUntil || row.validUntil >= now);
    if (valid && row !== null) {
      promo = {
        code: row.code,
        label: row.label,
        percentOffBps: row.percentOffBps,
        applyToInitialFee: row.applyToInitialFee,
        cadenceLock: (row.cadenceLock as CheckoutPromo['cadenceLock']) ?? null,
      };
    }
  }
  const initialCadence =
    promo?.cadenceLock ??
    (cadenceParam === 'MONTHLY' ||
    cadenceParam === 'SEMESTRAL' ||
    cadenceParam === 'ANNUAL'
      ? (cadenceParam as 'MONTHLY' | 'SEMESTRAL' | 'ANNUAL')
      : null);
  const plan =
    plans.find(
      (p) => p.type === ((resumeData?.planType ?? planParam) as PlanType),
    ) ?? plans[0];
  if (!plan) {
    return (
      <main
        data-testid="checkout-page"
        className="flex flex-1 items-center justify-center px-6 py-16"
      >
        <p className="text-sm text-zinc-600">
          Aún no hay planes disponibles. Vuelve pronto.
        </p>
      </main>
    );
  }

  return (
    <main
      data-testid="checkout-page"
      className="flex flex-1 flex-col items-center px-6 py-12"
    >
      <div className="w-full max-w-xl">
        <h1
          data-testid="checkout-headline"
          className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 animate-fade-up [animation-delay:60ms]"
        >
          {resumeData ? 'Termina tu pago' : 'Activa tu Angela'}
        </h1>
        <p className="mt-2 text-base text-zinc-500 animate-fade-up [animation-delay:140ms]">
          {resumeData
            ? 'Tu cuenta ya está creada. Solo falta confirmar el pago para activar el servicio.'
            : 'Crea tu cuenta familiar y completa tu primer mes de monitoreo.'}
        </p>

        <CheckoutForm
          plan={plan}
          publishableKey={env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}
          resumeData={resumeData}
          promo={promo}
          initialCadence={initialCadence}
          initialSource={sourceParam ?? null}
        />
      </div>
    </main>
  );
}
