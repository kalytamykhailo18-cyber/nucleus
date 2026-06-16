'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { loadStripe, type Stripe, type StripeElements } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
import {
  LuCircleAlert,
  LuEye,
  LuEyeOff,
  LuLoader,
  LuShield,
} from 'react-icons/lu';
import Link from 'next/link';
import { SectionLabel } from '@/components/section-label';
import { LuHeart, LuUser } from 'react-icons/lu';
import {
  ADVERTISED_DISCOUNT_PCT,
  DEVICE_NET_CENTAVOS,
  SHIPPING_NET_CENTAVOS,
  formatAmountMXN,
  grossCentsForNet,
  ivaCentsForNet,
  type BillingCadence,
  type PlanSummary,
} from '@/lib/plans';

const CADENCE_LABEL: Record<BillingCadence, string> = {
  MONTHLY: 'Mensual',
  SEMESTRAL: 'Semestral',
  ANNUAL: 'Anual',
};

function planHasCadencePricing(plan: PlanSummary): boolean {
  return (
    plan.initialFeeCents !== null &&
    plan.priceMonthlyCents !== null &&
    plan.priceSemestralCents !== null &&
    plan.priceAnnualCents !== null
  );
}

function cadencePriceCents(
  plan: PlanSummary,
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

/**
 * Inline checkout. Single client component:
 *   1. Collect family-member account fields + optional details.
 *   2. POST `/api/checkout/start` → creates pending User + Subscription
 *      and returns a Stripe PaymentIntent clientSecret.
 *   3. Mount Stripe Elements with the clientSecret, render the card form.
 *   4. On confirm, Stripe charges the card. We mark the subscription
 *      ACTIVE via `/api/checkout/finalize`, then call `signIn` so the
 *      redirect to /dashboard arrives already authenticated.
 *
 * Webhook does the same thing on the backend if the user closes the tab
 * mid-confirm — both paths idempotently write the same state.
 */

interface FormState {
  email: string;
  password: string;
  confirmPassword: string;
  fullName: string;
  phone: string;
}

interface ResumeData {
  clientSecret: string;
  subscriptionId: string;
  planType: string;
}

export interface CheckoutPromo {
  code: string;
  label: string;
  percentOffBps: number;
  applyToInitialFee: boolean;
  cadenceLock: BillingCadence | null;
}

export function CheckoutForm({
  plan,
  publishableKey,
  resumeData = null,
  promo = null,
  initialCadence = null,
  initialSource = null,
}: {
  plan: PlanSummary;
  publishableKey: string;
  resumeData?: ResumeData | null;
  promo?: CheckoutPromo | null;
  initialCadence?: BillingCadence | null;
  initialSource?: string | null;
}) {
  const stripePromise = useMemo(() => loadStripe(publishableKey), [publishableKey]);

  const [form, setForm] = useState<FormState>({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    phone: '',
  });
  const [clientSecret, setClientSecret] = useState<string | null>(
    resumeData?.clientSecret ?? null,
  );
  const [subscriptionId, setSubscriptionId] = useState<string | null>(
    resumeData?.subscriptionId ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  // Default the cadence selector to MONTHLY when the plan has cadence
  // pricing; otherwise the picker hides and the legacy single-rate flow
  // takes over. A promo with a cadenceLock (e.g. PEMEX10 = ANNUAL)
  // forces the initial value, and the URL's ?cadence= overrides the
  // default when no promo dictates it.
  const [cadence, setCadence] = useState<BillingCadence>(
    promo?.cadenceLock ?? initialCadence ?? 'MONTHLY',
  );
  const cadencePricingActive = planHasCadencePricing(plan);
  const isResume = resumeData !== null;

  const accountValid =
    form.email.includes('@') &&
    form.password.length >= 8 &&
    form.password === form.confirmPassword &&
    form.fullName.trim().length > 0 &&
    form.phone.trim().length >= 10 &&
    termsAccepted;

  async function startCheckout(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/checkout/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planType: plan.type,
          email: form.email.trim().toLowerCase(),
          password: form.password,
          fullName: form.fullName.trim(),
          phone: form.phone.trim() || null,
          cadence: cadencePricingActive ? cadence : undefined,
          promo: promo?.code,
          source: initialSource ?? undefined,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
        setError(body.message ?? body.error ?? 'No se pudo iniciar el cobro.');
        return;
      }
      const body = (await res.json()) as { clientSecret: string; subscriptionId: string };
      setClientSecret(body.clientSecret);
      setSubscriptionId(body.subscriptionId);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 space-y-6">
      {cadencePricingActive ? (
        <CadencePicker plan={plan} cadence={cadence} setCadence={setCadence} />
      ) : null}
      <PlanSummaryCard
        plan={plan}
        cadence={cadencePricingActive ? cadence : null}
        promo={promo}
      />

      {isResume && (
        <div
          data-testid="checkout-resume-notice"
          className="rounded-2xl bg-amber-50 px-4 py-3 text-xs text-amber-800 ring-1 ring-amber-200"
        >
          Detectamos que tu pago anterior no se completó. Confirma el pago
          aquí abajo para activar tu Angela.
        </div>
      )}

      {!clientSecret && (
        <div className="card-surface rounded-3xl p-6">
          <SectionLabel icon={LuUser} tone="sky">
            Tus datos
          </SectionLabel>
          <p className="mt-2 text-xs text-zinc-500">
            Tú eres quien paga e inicia sesión. Después del pago te
            preguntamos por los datos del usuario de la Angela (tu familiar).
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Email" name="email" type="email" form={form} setForm={setForm} required />
            <Field label="Nombre completo" name="fullName" form={form} setForm={setForm} required />
            <Field label="Contraseña" name="password" type="password" form={form} setForm={setForm} required />
            <Field label="Confirmar contraseña" name="confirmPassword" type="password" form={form} setForm={setForm} required />
            <Field
              label="Teléfono"
              name="phone"
              type="tel"
              form={form}
              setForm={setForm}
              required
              hint="A este número te llama el call-center si tu familiar pide ayuda."
            />
          </div>

          {error && (
            <p
              role="alert"
              data-testid="checkout-error"
              className="mt-4 flex items-start gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200"
            >
              <LuCircleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
              {error}
            </p>
          )}

          <label
            htmlFor="checkout-terms"
            className="mt-6 flex cursor-pointer items-start gap-3"
          >
            <input
              id="checkout-terms"
              type="checkbox"
              data-testid="checkout-terms"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 cursor-pointer rounded border-zinc-300 text-sensu-500 focus:ring-sensu-300"
            />
            <span className="text-xs leading-relaxed text-zinc-600">
              He leído y acepto los{' '}
              <Link
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-600 underline underline-offset-2 hover:text-sky-700"
              >
                Términos y Condiciones
              </Link>{' '}
              y el{' '}
              <Link
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-600 underline underline-offset-2 hover:text-sky-700"
              >
                Aviso de Privacidad
              </Link>{' '}
              de Sensu.
            </span>
          </label>

          <button
            type="button"
            data-testid="checkout-continue"
            disabled={!accountValid || busy}
            onClick={startCheckout}
            className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-sensu-500 text-sm font-medium tracking-tight text-white transition-transform hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {busy ? <LuLoader aria-hidden className="h-4 w-4 animate-spin" /> : null}
            {busy ? 'Preparando…' : 'Continuar al pago'}
          </button>
        </div>
      )}

      {clientSecret && subscriptionId && (
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret,
            // Spanish labels — "Número de tarjeta" instead of "Card
            // number", etc. Stripe's locale enum has `es-419` (Latin
            // American Spanish) but not a Mexico-specific `es-MX`; 419
            // is the canonical locale for our market.
            locale: 'es-419',
            appearance: {
              theme: 'stripe',
              variables: {
                colorPrimary: '#ff5757',
                colorText: '#0f172a',
                colorBackground: '#ffffff',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                borderRadius: '12px',
              },
            },
          }}
        >
          <PaymentSection
            email={form.email.trim().toLowerCase()}
            password={form.password}
            subscriptionId={subscriptionId}
            skipSignin={isResume}
          />
        </Elements>
      )}
    </div>
  );
}

function CadencePicker({
  plan,
  cadence,
  setCadence,
}: {
  plan: PlanSummary;
  cadence: BillingCadence;
  setCadence: (c: BillingCadence) => void;
}): React.ReactElement {
  const options: BillingCadence[] = ['MONTHLY', 'SEMESTRAL', 'ANNUAL'];
  return (
    <div
      data-testid="checkout-cadence-picker"
      className="card-surface rounded-3xl p-4"
    >
      <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
        Plan de servicio
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {options.map((opt) => {
          const netCents = cadencePriceCents(plan, opt);
          if (netCents === null) return null;
          const discountPct = ADVERTISED_DISCOUNT_PCT[opt];
          const active = opt === cadence;
          return (
            <button
              key={opt}
              type="button"
              data-testid={`checkout-cadence-${opt}`}
              aria-pressed={active}
              onClick={() => setCadence(opt)}
              className={`flex flex-col items-start rounded-2xl px-4 py-3 text-left transition-transform hover:-translate-y-0.5 cursor-pointer ${
                active
                  ? 'bg-zinc-900 text-white ring-2 ring-zinc-900'
                  : 'bg-white text-zinc-900 ring-1 ring-zinc-200 hover:bg-zinc-50'
              }`}
            >
              <span className="text-sm font-medium tracking-tight">
                {CADENCE_LABEL[opt]}
              </span>
              <span
                className={`mt-1 text-sm tabular-nums ${
                  active ? 'text-white' : 'text-zinc-700'
                }`}
              >
                {formatAmountMXN(grossCentsForNet(netCents))}
              </span>
              {discountPct !== null && discountPct > 0 ? (
                <span
                  className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    active
                      ? 'bg-emerald-500/20 text-emerald-200'
                      : 'bg-emerald-50 text-emerald-700'
                  }`}
                >
                  Ahorra {discountPct}%
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PlanSummaryCard({
  plan,
  cadence,
  promo = null,
}: {
  plan: PlanSummary;
  cadence: BillingCadence | null;
  promo?: CheckoutPromo | null;
}): React.ReactElement {
  // 2026-05-26 pricing pivot — when a cadence is selected and the plan
  // has cadence pricing configured, swap to the initial-fee + recurring
  // breakdown. Plans without cadence prices fall through to the legacy
  // "monitoring + connection + device gratis" breakdown.
  if (cadence !== null && plan.initialFeeCents !== null) {
    return (
      <PlanSummaryCadenceCard plan={plan} cadence={cadence} promo={promo} />
    );
  }
  return <PlanSummaryLegacyCard plan={plan} />;
}

function PlanSummaryCadenceCard({
  plan,
  cadence,
  promo = null,
}: {
  plan: PlanSummary;
  cadence: BillingCadence;
  promo?: CheckoutPromo | null;
}): React.ReactElement {
  // Device + activation are the upfront one-time line items. The
  // recurring side carries the chosen cadence's net price.
  const ACTIVATION_NET = Math.max(
    0,
    (plan.initialFeeCents ?? 0) - DEVICE_NET_CENTAVOS,
  );
  const recurringNet = cadencePriceCents(plan, cadence) ?? 0;
  const oneTimeItems: Array<{ label: string; sub?: string; cents: number }> = [
    {
      label: 'Dispositivo Angela',
      sub: 'Pendant + correa + estuche. Pago único.',
      cents: DEVICE_NET_CENTAVOS,
    },
    {
      label: 'Activación celular',
      sub: 'Configuración de la SIM y prueba de cobertura.',
      cents: ACTIVATION_NET,
    },
    {
      label: 'Envío',
      sub: 'Mensajería a tu domicilio en México. Pago único.',
      cents: SHIPPING_NET_CENTAVOS,
    },
  ];
  const recurringItem = {
    label: `Servicio ${CADENCE_LABEL[cadence]}`,
    sub: 'Monitoreo 24/7, call-center, panel familiar y soporte humano.',
    cents: recurringNet,
  };
  const subtotalNet = oneTimeItems.reduce((s, i) => s + i.cents, 0) + recurringNet;
  const ivaCents = ivaCentsForNet(subtotalNet);
  // Promo discount applied to the gross total. PEMEX10 (and any future
  // applyToInitialFee=true partner code) discounts the WHOLE annual
  // prepay; recurring-only promos discount just the servicio slice's
  // gross. Math mirrors /api/checkout/start so the visible total here
  // always matches what Stripe charges.
  const grossSubtotal = subtotalNet + ivaCents;
  const discountSlice = promo
    ? promo.applyToInitialFee
      ? grossSubtotal
      : grossCentsForNet(recurringNet)
    : 0;
  const promoDiscountCents = promo
    ? Math.round((discountSlice * promo.percentOffBps) / 10_000)
    : 0;
  const totalTodayCents = grossSubtotal - promoDiscountCents;

  return (
    <div
      data-testid="checkout-plan"
      className="card-surface rounded-3xl px-6 py-5 animate-fade-up"
    >
      <p className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
        <LuShield
          aria-hidden
          className={`h-4 w-4 ${plan.includesAura ? 'text-violet-500' : 'text-emerald-500'}`}
        />
        <span data-testid="checkout-plan-name">{plan.name}</span>
      </p>

      <p className="mt-3 text-xs uppercase tracking-[0.14em] text-zinc-500">
        Pago único hoy
      </p>
      <ul className="mt-2 space-y-3">
        {oneTimeItems.map((item) => (
          <li key={item.label} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-zinc-900">{item.label}</p>
              <p className="mt-0.5 text-xs leading-snug text-zinc-500">{item.sub}</p>
            </div>
            <p className="shrink-0 text-sm tabular-nums text-zinc-700">
              {formatAmountMXN(item.cents)}
            </p>
          </li>
        ))}
      </ul>

      <p className="mt-5 text-xs uppercase tracking-[0.14em] text-zinc-500">
        Servicio recurrente
      </p>
      <ul className="mt-2 space-y-3">
        <li className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-zinc-900">{recurringItem.label}</p>
            <p className="mt-0.5 text-xs leading-snug text-zinc-500">{recurringItem.sub}</p>
          </div>
          <p className="shrink-0 text-sm tabular-nums text-zinc-700">
            {formatAmountMXN(recurringItem.cents)}
          </p>
        </li>
      </ul>

      <div className="mt-5 space-y-2 border-t border-zinc-100 pt-4 text-sm">
        <div className="flex items-center justify-between text-zinc-600">
          <span>Subtotal</span>
          <span data-testid="checkout-plan-subtotal" className="tabular-nums">
            {formatAmountMXN(subtotalNet)}
          </span>
        </div>
        <div className="flex items-center justify-between text-zinc-600">
          <span>IVA (16%)</span>
          <span data-testid="checkout-plan-iva" className="tabular-nums">
            {formatAmountMXN(ivaCents)}
          </span>
        </div>
        {promo && promoDiscountCents > 0 && (
          <div
            data-testid="checkout-plan-promo"
            className="flex items-center justify-between text-emerald-700"
          >
            <span>
              {promo.label} (−{promo.percentOffBps / 100}%)
            </span>
            <span
              data-testid="checkout-plan-promo-amount"
              className="tabular-nums"
            >
              −{formatAmountMXN(promoDiscountCents)}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between pt-2">
          <span className="text-base font-medium text-zinc-900">Total hoy</span>
          <span
            data-testid="checkout-plan-total"
            className="text-base font-semibold tabular-nums text-zinc-900"
          >
            {formatAmountMXN(totalTodayCents)}
          </span>
        </div>
        {/* Legacy testid kept on the gross "total today" so the visitor-
            lens checkout spec keeps asserting against a stable hook. */}
        <span
          data-testid="checkout-plan-price"
          className="sr-only"
        >
          {formatAmountMXN(totalTodayCents)}
        </span>
        {/* Recurring-amount line (Juan 2026-05-27 13:16): make it
            unambiguous that the one-time device + activación drop off
            after the first cycle and only the servicio recurs. The
            cycle noun adapts to the chosen cadence. */}
        <div
          data-testid="checkout-plan-recurring-amount"
          className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-3 text-sm text-zinc-700"
        >
          <span>
            Pago desde el{' '}
            {cadence === 'MONTHLY'
              ? 'mes'
              : cadence === 'SEMESTRAL'
                ? 'semestre'
                : 'año'}{' '}
            2 en adelante
          </span>
          <span className="tabular-nums">
            {formatAmountMXN(grossCentsForNet(recurringNet))}
          </span>
        </div>
        <p
          data-testid="checkout-plan-recurring"
          className="pt-2 text-[11px] leading-snug text-zinc-500"
        >
          Después del primer ciclo, se renueva automáticamente cada{' '}
          {cadence === 'MONTHLY' ? 'mes' : cadence === 'SEMESTRAL' ? 'semestre' : 'año'}{' '}
          al precio de {CADENCE_LABEL[cadence].toLowerCase()} más IVA.
        </p>
      </div>
    </div>
  );
}

function PlanSummaryLegacyCard({ plan }: { plan: PlanSummary }) {
  // Three-line cost breakdown (Juan 2026-05-19). The net monthly price
  // ($8,200) is the sum of these three buckets — the device line is
  // bundled free with the subscription, so the gratis row carries 0¢.
  // If the plan's net ever drifts from $8,200, the "Monitoreo y Call
  // Center" bucket absorbs the delta so the three lines still sum to
  // the recurring charge.
  const CONNECTION_CENTS = 220_000; // Conexión + GPS + App móvil
  const monitoringCents = Math.max(0, plan.monitoringPriceCents - CONNECTION_CENTS);
  const lineItems: Array<{ label: string; sub?: string; cents: number; isFree?: boolean }> = [
    {
      label: 'Monitoreo y Call Center',
      sub: 'Atención humana 24/7 los 365 días del año.',
      cents: monitoringCents,
    },
    {
      label: 'Conexión + GPS + App móvil',
      sub: 'SIM celular, geolocalización en vivo y panel familiar.',
      cents: CONNECTION_CENTS,
    },
    {
      label: 'Dispositivo Angela',
      sub: 'Incluido sin costo con la suscripción.',
      cents: 0,
      isFree: true,
    },
  ];
  if (plan.oneTimePriceCents !== null && plan.oneTimePriceCents > 0) {
    lineItems.push({
      label: 'Angela (equipo adicional)',
      sub: 'Pago único. Te llega a casa en 2 días hábiles.',
      cents: plan.oneTimePriceCents,
    });
  }
  const subtotalNetCents = lineItems.reduce((sum, item) => sum + item.cents, 0);
  const ivaCents = ivaCentsForNet(subtotalNetCents);
  const totalTodayCents = subtotalNetCents + ivaCents;
  const hasDeviceLineItem =
    plan.oneTimePriceCents !== null && plan.oneTimePriceCents > 0;
  const recurringGrossCents = grossCentsForNet(plan.monitoringPriceCents);

  return (
    <div
      data-testid="checkout-plan"
      className="card-surface rounded-3xl px-6 py-5 animate-fade-up"
    >
      <p className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
        <LuShield
          aria-hidden
          className={`h-4 w-4 ${plan.includesAura ? 'text-violet-500' : 'text-emerald-500'}`}
        />
        <span data-testid="checkout-plan-name">{plan.name}</span>
      </p>

      <ul
        data-testid="checkout-plan-breakdown"
        className="mt-4 space-y-3"
      >
        {lineItems.map((item) => (
          <li
            key={item.label}
            className="flex items-start justify-between gap-3"
          >
            <div className="min-w-0">
              <p className="text-sm text-zinc-900">{item.label}</p>
              {item.sub && (
                <p className="mt-0.5 text-xs leading-snug text-zinc-500">
                  {item.sub}
                </p>
              )}
            </div>
            <p
              className={`shrink-0 text-sm tabular-nums ${item.isFree ? 'font-medium text-emerald-600' : 'text-zinc-700'}`}
            >
              {item.isFree ? 'Gratis' : formatAmountMXN(item.cents)}
            </p>
          </li>
        ))}
      </ul>

      <div className="mt-5 space-y-2 border-t border-zinc-100 pt-4 text-sm">
        <div className="flex items-center justify-between text-zinc-600">
          <span>Subtotal</span>
          <span
            data-testid="checkout-plan-subtotal"
            className="tabular-nums"
          >
            {formatAmountMXN(subtotalNetCents)}
          </span>
        </div>
        <div className="flex items-center justify-between text-zinc-600">
          <span>IVA (16%)</span>
          <span
            data-testid="checkout-plan-iva"
            className="tabular-nums"
          >
            {formatAmountMXN(ivaCents)}
          </span>
        </div>
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm font-medium text-zinc-900">Total a pagar hoy</p>
          <p
            data-testid="checkout-plan-price"
            className="text-xl font-semibold tabular-nums text-zinc-900"
          >
            {formatAmountMXN(totalTodayCents)}
          </p>
        </div>
      </div>
      <p
        data-testid="checkout-plan-recurring"
        className="mt-2 text-xs leading-relaxed text-zinc-500"
      >
        {hasDeviceLineItem
          ? `Después de hoy, el cargo mensual recurrente es de ${formatAmountMXN(recurringGrossCents)} (IVA incluido). Cancela cuando quieras.`
          : `Después de hoy, el cargo mensual recurrente es de ${formatAmountMXN(recurringGrossCents)} con IVA incluido. Cancela cuando quieras.`}
      </p>
    </div>
  );
}

function Field({
  label,
  name,
  type = 'text',
  form,
  setForm,
  required,
  hint,
}: {
  label: string;
  name: keyof FormState;
  type?: 'text' | 'email' | 'password' | 'tel';
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  required?: boolean;
  hint?: string;
}) {
  const [reveal, setReveal] = useState(false);
  const isPassword = type === 'password';
  const effectiveType = isPassword && reveal ? 'text' : type;

  return (
    <label className="text-sm">
      <span className="block text-xs uppercase tracking-[0.14em] text-zinc-500">
        {label}
        {required ? '' : ' (opcional)'}
      </span>
      <span className="relative mt-1.5 block">
        <input
          type={effectiveType}
          data-testid={`checkout-${name}`}
          value={form[name]}
          onChange={(e) => setForm({ ...form, [name]: e.target.value })}
          autoComplete={
            name === 'email' ? 'email' : name === 'password' ? 'new-password' : name === 'confirmPassword' ? 'new-password' : name === 'phone' ? 'tel' : 'name'
          }
          className={`block w-full rounded-xl border border-zinc-200 bg-white py-2 text-zinc-900 outline-none focus:border-sensu-400 focus:ring-2 focus:ring-sensu-200 ${isPassword ? 'pl-3 pr-10' : 'px-3'}`}
        />
        {isPassword && (
          <button
            type="button"
            data-testid={`checkout-${name}-toggle`}
            aria-label={reveal ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            onClick={() => setReveal((r) => !r)}
            className="absolute inset-y-0 right-2 inline-flex items-center justify-center rounded-full px-2 text-sky-500 transition-colors hover:bg-sky-50 hover:text-sky-700"
          >
            {reveal ? (
              <LuEyeOff aria-hidden className="h-4 w-4 text-sky-500" />
            ) : (
              <LuEye aria-hidden className="h-4 w-4 text-sky-500" />
            )}
          </button>
        )}
      </span>
      {hint && (
        <span className="mt-1 block text-[11px] leading-snug text-zinc-500">
          {hint}
        </span>
      )}
    </label>
  );
}

function PaymentSection({
  email,
  password,
  subscriptionId,
  skipSignin = false,
}: {
  email: string;
  password: string;
  subscriptionId: string;
  /** Resume flow: the user is already authenticated, skip the signIn call. */
  skipSignin?: boolean;
}) {
  const stripe: Stripe | null = useStripe();
  const elements: StripeElements | null = useElements();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  async function pay(): Promise<void> {
    if (!stripe || !elements || startedRef.current) return;
    startedRef.current = true;
    setBusy(true);
    setError(null);

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/checkout/return` },
      redirect: 'if_required',
    });

    if (result.error) {
      setError(result.error.message ?? 'No se pudo procesar el pago.');
      setBusy(false);
      startedRef.current = false;
      return;
    }

    // Stripe returned `succeeded` synchronously (test card 4242 always
    // does). Tell the server to flip Subscription → ACTIVE, then sign in.
    const finalize = await fetch('/api/checkout/finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscriptionId }),
    });
    if (!finalize.ok) {
      setError('Pago aceptado pero no pudimos activar tu cuenta. Contacta al equipo Sensu.');
      setBusy(false);
      return;
    }

    if (!skipSignin) {
      const signinRes = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });
      if (signinRes?.error) {
        setError('No pudimos iniciar sesión automáticamente. Inicia sesión a mano.');
        setBusy(false);
        return;
      }
    }
    // After payment, family lands on the questionnaire (senior data) before
    // the dashboard. Dashboard server-side also gates on this in case the
    // browser redirect is bypassed.
    router.push('/onboarding/questionnaire');
  }

  // Pre-load Stripe Elements as soon as the clientSecret is available.
  useEffect(() => {
    // No-op effect — Elements mounts via the parent provider.
  }, []);

  return (
    <div data-testid="checkout-payment" className="card-surface rounded-3xl p-6">
      <SectionLabel icon={LuHeart} tone="rose">
        Pago seguro
      </SectionLabel>
      <p className="mt-2 text-xs text-zinc-500">
        Procesado por Stripe. No guardamos los datos de tu tarjeta.
      </p>
      <div className="mt-5">
        <PaymentElement
          options={{
            layout: 'tabs',
            defaultValues: {
              billingDetails: { address: { country: 'MX' } },
            },
          }}
        />
      </div>

      {error && (
        <p
          role="alert"
          data-testid="checkout-error"
          className="mt-4 flex items-start gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200"
        >
          <LuCircleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
          {error}
        </p>
      )}

      <button
        type="button"
        data-testid="checkout-pay"
        disabled={!stripe || !elements || busy}
        onClick={pay}
        className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-sensu-500 text-sm font-medium tracking-tight text-white transition-transform hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50 disabled:hover:translate-y-0"
      >
        {busy ? <LuLoader aria-hidden className="h-4 w-4 animate-spin" /> : null}
        {busy ? 'Procesando…' : 'Pagar y activar'}
      </button>
    </div>
  );
}
