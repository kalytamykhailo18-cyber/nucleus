import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { normalizeEmail } from '@/lib/email';
import { stripe } from '@/lib/stripe';
import { env } from '@/lib/env';
import {
  fetchPlanByType,
  grossCentsForNet,
  isFreeShippingActive,
  SHIPPING_NET_CENTAVOS,
  PLAN_PICKER,
  type BillingCadence,
  type PlanType,
} from '@/lib/plans';
import {
  SIGNUP_SOURCE_COOKIE,
  resolveSignupSource,
  sanitizeSource,
} from '@/lib/signup-source';
import { syncContact } from '@/lib/hubspot';

/**
 * Creates a pending User + Subscription pair, then a Stripe PaymentIntent
 * for the plan's monthly price. Returns the clientSecret so the browser
 * can confirm the card with Stripe Elements.
 *
 * If the email already exists, we 409 — checkout is for new accounts.
 * Existing customers should sign in and upgrade from the dashboard
 * (Phase B work).
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  planType: z.enum(['ANGELA_ESENCIAL', 'ANGELA_TOTAL']),
  email: z.string().email(),
  password: z.string().min(8).max(1024),
  fullName: z.string().min(1).max(255),
  phone: z.string().max(40).nullable().optional(),
  // 2026-05-26 pricing pivot. Optional during the migration so plans
  // without cadence prices configured still flow through the legacy
  // single-monitoringPrice path.
  cadence: z.enum(['MONTHLY', 'SEMESTRAL', 'ANNUAL']).optional(),
  // Partner promo code (e.g. PEMEX10 — 10% off annual prepay total).
  // Optional. When provided, validated against the PromoCode table:
  // unknown code, expired window, or cadence mismatch all 422 with a
  // user-facing Spanish message; valid codes apply their percent off
  // the relevant slice (recurring only, or recurring + initial fee +
  // shipping, depending on applyToInitialFee).
  promo: z.string().min(1).max(40).optional(),
  // Marketing-attribution source from the checkout URL (Phase A+ #2,
  // 2026-06-10). Already whitelisted client-side; server re-sanitizes.
  source: z.string().max(40).optional().nullable(),
  // Plan-picker option (Juan 2026-06-18). Optional and gated behind
  // NEXT_PUBLIC_PLAN_PICKER_ENABLED on the UI side; the route accepts
  // it whenever it lands so a later flag flip is a UI delta only.
  //   'A' → drop the $500 shipping line from the upfront total
  //         (initial fee + first month, no envío). Cadence forced to
  //         MONTHLY since Option A is "initial + mensualidad".
  //   'B' → single $10,117 PaymentIntent in 6 MSI on the customer's
  //         card; cadence forced to ANNUAL so the renewal worker
  //         kicks back in 12 months from charge with the normal
  //         monthly cycle.
  pickerOption: z.enum(['A', 'B']).optional(),
  // Plan-B installment shape (Juan 2026-07-30). Only honored when
  // pickerOption === 'B'. Controls whether the PaymentIntent is
  // created with `installments.enabled: true` (six/twelve) or as a
  // one-shot card charge (single). The specific 6-vs-12 forcing
  // happens at confirm time on the client.
  planBChoice: z.enum(['single', 'six', 'twelve']).optional(),
  // Sales-rep attribution slug (Juan 2026-07-30 direct-sales pivot).
  // Threaded from the ?rep=<slug> URL param through the checkout
  // form. Server looks up an active SalesRep by slug and sets
  // attributionRepId + attributionSource='url_param' on the created
  // Subscription. An unknown or inactive slug is silently ignored —
  // the subscription is still created, just without attribution.
  repSlug: z.string().max(64).optional(),
});

function cadencePriceForPlan(
  plan: {
    priceMonthlyCents: number | null;
    priceSemestralCents: number | null;
    priceAnnualCents: number | null;
  },
  cadence: BillingCadence,
): number | null {
  switch (cadence) {
    case 'MONTHLY':
      return plan.priceMonthlyCents;
    case 'SEMESTRAL':
      return plan.priceSemestralCents;
    case 'ANNUAL':
      return plan.priceAnnualCents;
  }
}

export async function POST(request: NextRequest) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', message: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 422 },
    );
  }

  const email = normalizeEmail(parsed.data.email);
  if (!email) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 422 });
  }

  // Block duplicate signups — same case-insensitive collation as auth.
  const existing = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "User" WHERE LOWER(email) = ${email} LIMIT 1
  `;
  if (existing.length > 0) {
    return NextResponse.json(
      {
        error: 'Email exists',
        message: 'Ya hay una cuenta con ese email. Inicia sesión para continuar.',
      },
      { status: 409 },
    );
  }

  const plan = await fetchPlanByType(parsed.data.planType as PlanType);
  if (!plan) {
    return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
  }

  // 2026-05-26 pricing pivot: when the requested cadence resolves to
  // a configured price, charge the one-time initial fee + the recurring
  // first-period together upfront. Plans without a cadence configured
  // (or callers that don't pass cadence) fall back to the legacy
  // single-monitoringPrice path so existing flows keep working through
  // the migration.
  //
  // Plan-picker (Juan 2026-06-18) overrides parts of the breakdown:
  //   - Option A forces MONTHLY cadence and drops the $500 envío line.
  //   - Option B forces ANNUAL cadence and replaces the recurring net
  //     with the picker's headline $10,117 gross (net derived). The
  //     PaymentIntent below then gets the 6-MSI installments option.
  const pickerOption = parsed.data.pickerOption ?? null;
  // Buyer's Plan B payment-shape choice (default 'six' for backwards
  // compatibility with clients that predate the pivot). Only honored
  // when pickerOption === 'B'.
  const planBChoice = parsed.data.planBChoice ?? 'six';
  const planBWantsInstallments =
    pickerOption === 'B' && (planBChoice === 'six' || planBChoice === 'twelve');
  // Plan B persists with cadence=MONTHLY so the renewal worker bills
  // the normal $638/mo from month 13 onwards. The upfront $10,117
  // covers months 1-12; the webhook handler advances currentPeriodEnd
  // by 12 months at activation (instead of the default 1 month) so the
  // first renewal tick fires at month 13 not month 2.
  const effectiveCadence: BillingCadence | null =
    pickerOption === 'A' || pickerOption === 'B'
      ? 'MONTHLY'
      : (parsed.data.cadence ?? null);
  const cadenceNetCents =
    pickerOption === 'B'
      ? PLAN_PICKER.B.annualNetCentavos
      : effectiveCadence !== null
        ? cadencePriceForPlan(plan, effectiveCadence)
        : null;
  const useCadencePricing =
    cadenceNetCents !== null && plan.initialFeeCents !== null;

  // Plan B's $10,117 already bundles the initial fee with twelve
  // months of recurring (it matches $2,461 initial + 12 × $638 to the
  // centavo). Adding `Plan.initialFeeCents` on top would double-charge
  // the buyer ~$2,461 (Juan caught this 2026-06-19 — Stripe iframe
  // was showing 6 × $2,096 = $12,578 instead of the headline $10,117).
  const initialFeeGross =
    useCadencePricing && pickerOption !== 'B'
      ? grossCentsForNet(plan.initialFeeCents!)
      : 0;
  // Envío is a flat one-time line, billed alongside Dispositivo +
  // Activación for cadence-aware buys. Was $500 from 2026-05-28 to
  // 2026-06-19, then halved to $250 once the Plan A + B picker rolled
  // out. Plan B's $10,117 is already the all-in annual prepay (it
  // matches $2,461 initial + 12 × $638 monthly to the centavo) so
  // shipping doesn't tack on top. Legacy single-monthly flows pre-
  // pivot stay shipping-free.
  // 2026-06-24 (Juan): the env-driven free-shipping window zeros the
  // line so Stripe charges exactly what the UI shows. Mirror lives in
  // checkout-form.tsx; both read `isFreeShippingActive` so they can
  // never diverge.
  const freeShippingActive = isFreeShippingActive(
    Date.now(),
    env.NUCLEUS_FREE_SHIPPING_UNTIL_ISO,
  );
  const shippingGross =
    useCadencePricing && pickerOption !== 'B' && !freeShippingActive
      ? grossCentsForNet(SHIPPING_NET_CENTAVOS)
      : 0;
  const recurringGrossBase = useCadencePricing
    ? grossCentsForNet(cadenceNetCents!)
    : grossCentsForNet(plan.monthlyPriceCents);
  // Pricing-split (Juan / commercial director 2026-06-19, gated by
  // NUCLEUS_PRICING_SPLIT_ENABLED). On Plan A only, drop the first
  // month from the upfront charge — the buyer pays Dispositivo +
  // Envío today (~$2,711 gross), then the renewal worker bills the
  // first $638 monthly cycle ASSISTED_FIRST_MONTH_DELAY_DAYS days
  // later off the saved card. Plan B already prepays the year, so
  // the split does not apply there.
  const pricingSplitActive =
    env.NUCLEUS_PRICING_SPLIT_ENABLED && pickerOption === 'A';
  const recurringGross = pricingSplitActive ? 0 : recurringGrossBase;
  const rawGrossCents = initialFeeGross + shippingGross + recurringGross;

  // Promo redemption — validate the code, compute the discount, and
  // persist both the code reference and the actual amount discounted
  // on the Subscription row. The amount lives on the row (instead of
  // being re-derived later from PromoCode.percentOffBps) because the
  // partner's negotiated rate can change after a redemption and the
  // historical charge must remain reproducible for refunds + reporting.
  let promoCodeId: string | null = null;
  let discountAmountCentavos = 0;
  // Tracks whether the promo above was server-auto-attached (e.g.
  // holiday Día del Padre) vs explicitly redeemed by the buyer
  // through a URL `?promo=` or partner page. Auto promos do not
  // pollute marketing attribution downstream — `signupSource` stays
  // at cookie/query/null instead of inheriting `holiday-*`.
  let promoWasAutoApplied = false;
  if (parsed.data.promo) {
    const code = parsed.data.promo.trim().toUpperCase();
    const promo = await prisma.promoCode.findUnique({ where: { code } });
    const now = new Date();
    if (
      !promo ||
      (promo.validFrom && promo.validFrom > now) ||
      (promo.validUntil && promo.validUntil < now)
    ) {
      return NextResponse.json(
        { error: 'Promo invalid', message: 'El código promocional no es válido.' },
        { status: 422 },
      );
    }
    if (promo.cadenceLock && promo.cadenceLock !== (effectiveCadence ?? null)) {
      return NextResponse.json(
        {
          error: 'Promo cadence mismatch',
          message: `Este código requiere cadencia ${promo.cadenceLock.toLowerCase()}.`,
        },
        { status: 422 },
      );
    }
    if (promo.maxRedemptions !== null) {
      const redeemed = await prisma.subscription.count({
        where: { promoCodeId: code },
      });
      if (redeemed >= promo.maxRedemptions) {
        return NextResponse.json(
          { error: 'Promo exhausted', message: 'Este código ya alcanzó su límite de canjes.' },
          { status: 422 },
        );
      }
    }
    const discountedSlice = promo.applyToInitialFee
      ? rawGrossCents
      : recurringGross;
    discountAmountCentavos = Math.round(
      (discountedSlice * promo.percentOffBps) / 10_000,
    );
    promoCodeId = code;
  } else {
    // Auto-applied holiday promo (Juan 2026-06-22). If no explicit
    // promo code was passed AND a holiday code is currently in window,
    // attach it silently. The buyer sees the discount line in the
    // breakdown without having to know the code. Stacks cleanly with
    // the cadence + pricing-split flows because we reuse the standard
    // promo math below.
    const now = new Date();
    const holiday = await prisma.promoCode.findFirst({
      where: {
        channel: { startsWith: 'holiday-' },
        validFrom: { lte: now },
        validUntil: { gte: now },
      },
      orderBy: { percentOffBps: 'desc' },
    });
    if (
      holiday &&
      (!holiday.cadenceLock || holiday.cadenceLock === (effectiveCadence ?? null))
    ) {
      const discountedSlice = holiday.applyToInitialFee
        ? rawGrossCents
        : recurringGross;
      discountAmountCentavos = Math.round(
        (discountedSlice * holiday.percentOffBps) / 10_000,
      );
      promoCodeId = holiday.code;
      promoWasAutoApplied = true;
    }
  }
  const grossCents = rawGrossCents - discountAmountCentavos;

  // Resolve marketing-attribution source — cookie > query > promo.channel.
  // Sticky-first cookie persists the original ad campaign; the query
  // param falls in as a hint for buyers who never hit a page that set the
  // cookie; promo.channel is the partner fallback (PEMEX10 → "pemex").
  const cookieSource = request.cookies.get(SIGNUP_SOURCE_COOKIE)?.value ?? null;
  const signupSource = await resolveSignupSource({
    cookieValue: cookieSource,
    querySource: sanitizeSource(parsed.data.source ?? null),
    // Auto-attached holiday promos are admin-driven pricing, not buyer
    // attribution, so they do NOT contribute to signupSource. Only
    // explicit (URL-passed) promos feed the marketing source field.
    promoCode: promoWasAutoApplied ? null : promoCodeId,
  });

  // Sales-rep attribution (Juan 2026-07-30). Look up the SalesRep by
  // slug if one arrived on the request. Unknown or inactive slugs are
  // silently ignored — the subscription is still created, just without
  // attribution, so a typo in a rep link never blocks the sale.
  const repSlugInput = parsed.data.repSlug?.trim().toLowerCase() ?? null;
  const attributionRep =
    repSlugInput && repSlugInput.length > 0
      ? await prisma.salesRep.findFirst({
          where: { slug: repSlugInput, active: true },
          select: { id: true },
        })
      : null;

  // Create the User + Subscription in one transaction. Both rows are
  // PENDING until the Stripe webhook (or the client's finalize call)
  // marks the Subscription ACTIVE.
  const { user, subscription } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        passwordHash: hashPassword(parsed.data.password),
        fullName: parsed.data.fullName,
        phone: parsed.data.phone ?? null,
        isActive: true,
        signupSource,
        // Questionnaire is collected post-payment at /onboarding/questionnaire,
        // not here. The dashboard gates on this flag and bounces unfinished
        // signups back to finish the senior's profile before letting them in.
        questionnaireCompleted: false,
      },
      select: { id: true, email: true },
    });
    const subscription = await tx.subscription.create({
      data: {
        userId: user.id,
        planId: plan.id,
        status: 'PENDING_PAYMENT',
        purchaseType: 'SUBSCRIPTION',
        amountPaidCentavos: grossCents,
        // Cadence + initial-fee bookkeeping so the dashboard can render
        // "Renewal · 12 ago 2027" + the cadence label, and so admin
        // reports separate the one-time charge from the recurring one.
        cadence: useCadencePricing ? effectiveCadence : null,
        // Bundle shipping into the persisted one-time amount so admin
        // reporting (and the dashboard renewal copy) treats it as part
        // of the upfront fee rather than the recurring servicio.
        initialFeePaidCentavos: useCadencePricing
          ? initialFeeGross + shippingGross
          : null,
        // Promo redemption — null when no code was applied, populated
        // when a partner discount was honored. Both fields move together
        // so admin reporting can join straight off promoCodeId.
        promoCodeId: promoCodeId,
        discountAmountCentavos: discountAmountCentavos > 0
          ? discountAmountCentavos
          : null,
        // Sales-rep attribution (Juan 2026-07-30). Set only when the
        // slug resolved to an active SalesRep. Historical / unattributed
        // subs keep both fields null.
        attributionRepId: attributionRep?.id ?? null,
        attributionSource: attributionRep ? 'url_param' : null,
      },
      select: { id: true },
    });
    return { user, subscription };
  });

  // Verification-traffic guard: signups landing on the @nucleus-test.local
  // domain are internal Playwright runs (2026-06-10). They never confirm
  // a card so every previous one minted a permanent "Incomplete"
  // PaymentIntent that cluttered Juan's live Stripe dashboard. Short-
  // circuit Stripe entirely for those emails, return a stub clientSecret
  // so the spec still sees a happy POST, and keep the User + Subscription
  // rows real so the rest of the assertions stand.
  const isVerificationTraffic = user.email.endsWith('@nucleus-test.local');

  let clientSecret: string | null = null;

  if (!isVerificationTraffic) {
    // Mint a Stripe Customer up-front and attach the PaymentIntent to it
    // so the Customer Portal (Juan 2026-06-08 ask) sees the full charge
    // history when the buyer clicks "Administrar suscripción" later. The
    // Customer id is persisted on the User row; subsequent purchases by
    // the same buyer reuse it instead of creating a parallel customer.
    const customer = await stripe().customers.create({
      email: user.email,
      name: parsed.data.fullName,
      phone: parsed.data.phone ?? undefined,
      metadata: { nucleusUserId: user.id },
    });
    await prisma.user.update({
      where: { id: user.id },
      data: { stripeCustomerId: customer.id },
    });

    const intent = await stripe().paymentIntents.create({
      amount: grossCents,
      currency: 'mxn',
      description:
        pickerOption === 'B'
          ? `${plan.name} (plan anual, ${
              planBChoice === 'single'
                ? 'pago único'
                : planBChoice === 'twelve'
                  ? '12 MSI'
                  : '6 MSI'
            })`
          : `${plan.name} (primer mes)`,
      customer: customer.id,
      receipt_email: user.email,
      automatic_payment_methods: { enabled: true },
      // Plan-picker Option B — Stripe Mexico MSI on the card slice.
      // We only set `installments.enabled` at create time because
      // Stripe rejects the specific `installments.plan` parameter when
      // confirm=false ("can only be used when confirm=true"). The
      // forced 6-MSI or 12-MSI plan lands on the client at
      // stripe.confirmPayment time — see checkout-form.tsx. When the
      // buyer picked pago único, we skip installments entirely so
      // Stripe charges the card as a normal one-shot purchase.
      ...(planBWantsInstallments
        ? {
            payment_method_options: {
              card: {
                installments: { enabled: true },
              },
            },
          }
        : {}),
      metadata: {
        nucleusSubscriptionId: subscription.id,
        nucleusUserId: user.id,
        planType: plan.type,
        ...(pickerOption ? { pickerOption } : {}),
        // Pricing-split control passes through to the webhook so the
        // FIRST currentPeriodEnd lands `firstMonthChargeDelayDays` days
        // out instead of the standard one month from a MONTHLY cadence.
        // The renewal worker then fires the first $638 cycle on schedule.
        ...(pricingSplitActive
          ? {
              firstMonthChargeDelayDays:
                env.ASSISTED_FIRST_MONTH_DELAY_DAYS.toString(),
            }
          : {}),
      },
    });

    // Store the PaymentIntent id on the Subscription so the webhook + the
    // finalize call can correlate without trusting client input.
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { stripePaymentIntentId: intent.id },
    });
    clientSecret = intent.client_secret;
  } else {
    // Stripe-shaped placeholder so the client-side Stripe Elements SDK
    // parses the secret without throwing. The Elements iframe will fail
    // to fetch a non-existent intent and show an error state — that is
    // fine: verification specs assert on POST shape, not on the iframe
    // contents.
    clientSecret = `pi_e2etest${subscription.id.slice(0, 8)}_secret_e2etest`;
  }

  // Fire-and-forget HubSpot upsert. Wrapped in a Promise so a slow
  // HubSpot HTTP call never delays the PaymentIntent return — checkout
  // UX stays snappy even when HubSpot is having a bad day.
  const promoChannel = promoCodeId
    ? (await prisma.promoCode.findUnique({
        where: { code: promoCodeId },
        select: { channel: true },
      }))?.channel ?? null
    : null;
  void syncContact({
    email: user.email,
    fullName: parsed.data.fullName,
    phone: parsed.data.phone ?? null,
    signupSource,
    planType: plan.type,
    pricePaidCentavos: grossCents,
    channel: promoChannel,
  });

  return NextResponse.json({
    clientSecret,
    subscriptionId: subscription.id,
  });
}
