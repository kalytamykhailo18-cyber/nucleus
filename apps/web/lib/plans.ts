import { prisma } from '@/lib/db';

export type PlanType = 'ANGELA_ESENCIAL' | 'ANGELA_TOTAL';

export type BillingCadence = 'MONTHLY' | 'SEMESTRAL' | 'ANNUAL';

export interface PlanSummary {
  id: string;
  type: PlanType;
  name: string;
  description: string;
  /** Monthly monitoring fee in centavos — recurring charge. */
  monitoringPriceCents: number;
  /** One-time device cost in centavos, or null if not applicable. */
  oneTimePriceCents: number | null;
  /** Alternative installment price in centavos, or null. */
  installmentPriceCents: number | null;
  /** Number of months the installment price is spread over, or null. */
  installmentMonths: number | null;
  currency: 'mxn';
  isPopular: boolean;
  /** Tier-only feature: only ANGELA_TOTAL includes Aura access. */
  includesAura: boolean;
  /** Legacy alias of monitoringPriceCents — kept for callers using the old name. */
  monthlyPriceCents: number;

  // 2026-05-26 pricing pivot. Net centavos; gross adds 16% IVA at the
  // display + Stripe layer. All four are nullable so plans that don't
  // yet have their cadence prices configured fall back to the legacy
  // monitoringPriceCents path.
  initialFeeCents: number | null;
  priceMonthlyCents: number | null;
  priceSemestralCents: number | null;
  priceAnnualCents: number | null;
}

const ESENCIAL_DESCRIPTION =
  'Angela, monitoreo 24/7 del call center, alertas en la app familiar y soporte humano cuando lo necesites.';
const TOTAL_DESCRIPTION =
  'Todo lo de Esencial más apoyo emocional con un especialista cuando tu familiar lo pida.';

export async function fetchActivePlans(): Promise<PlanSummary[]> {
  const rows = await prisma.plan.findMany({
    where: { isActive: true },
    // ANGELA_ESENCIAL → ANGELA_TOTAL alphabetic order is also the
    // natural cheapest-first order, no extra sort needed.
    orderBy: { type: 'asc' },
  });

  return rows.map((p) => ({
    id: p.id,
    type: p.type as PlanType,
    name: p.name,
    description:
      p.type === 'ANGELA_TOTAL' ? TOTAL_DESCRIPTION : ESENCIAL_DESCRIPTION,
    monitoringPriceCents: p.monitoringPrice,
    oneTimePriceCents: p.oneTimePrice ?? null,
    installmentPriceCents: p.installmentPrice ?? null,
    installmentMonths: p.installmentMonths ?? null,
    currency: 'mxn',
    isPopular: p.isPopular,
    includesAura: p.type === 'ANGELA_TOTAL',
    monthlyPriceCents: p.monitoringPrice,
    initialFeeCents: p.initialFeeCents ?? null,
    priceMonthlyCents: p.priceMonthlyCents ?? null,
    priceSemestralCents: p.priceSemestralCents ?? null,
    priceAnnualCents: p.priceAnnualCents ?? null,
  }));
}

/** Number of months covered by one billing period at the given cadence. */
export function monthsForCadence(cadence: BillingCadence): number {
  return cadence === 'MONTHLY' ? 1 : cadence === 'SEMESTRAL' ? 6 : 12;
}

/**
 * Marketing-side advertised discount per cadence — matches the labels
 * Juan locked in after his 2026-05-27 12:50 PM team huddle (Semestral
 * 7% / Anual 12%). Kept independent from `discountPctForCadence`
 * (which computes the actual math-based ratio against
 * monthly-times-N) so the picker surfaces the marketing label without
 * coupling it to the price-math.
 */
export const ADVERTISED_DISCOUNT_PCT: Record<BillingCadence, number | null> = {
  MONTHLY: null,
  SEMESTRAL: 7,
  ANNUAL: 12,
};

/** Spanish label for a cadence — capitalized for UI surfaces ("Mensual"). */
export function cadenceLabel(cadence: BillingCadence): string {
  return cadence === 'MONTHLY'
    ? 'Mensual'
    : cadence === 'SEMESTRAL'
      ? 'Semestral'
      : 'Anual';
}

/**
 * Compute the next renewal date by advancing the start date by the
 * cadence period. Uses calendar-month math (handled by Date.setMonth)
 * so the renewal lands on the same day of the month, falling back to
 * month-end when the source day doesn't exist (Jan 31 + 1mo → Feb 28).
 */
export function nextRenewalAt(
  startDate: Date,
  cadence: BillingCadence,
): Date {
  const next = new Date(startDate.getTime());
  next.setMonth(next.getMonth() + monthsForCadence(cadence));
  return next;
}

/**
 * Discount percentage relative to monthly-price-paid-monthly. For UI
 * "Ahorra 15%" / "Ahorra 20%" labels next to the longer-cadence
 * choices. Returns null when either side of the calc is missing so
 * the caller hides the label gracefully.
 */
export function discountPctForCadence(
  plan: PlanSummary,
  cadence: BillingCadence,
): number | null {
  if (plan.priceMonthlyCents === null) return null;
  const monthsByCadence: Record<BillingCadence, number> = {
    MONTHLY: 1,
    SEMESTRAL: 6,
    ANNUAL: 12,
  };
  const cadenceCents =
    cadence === 'MONTHLY'
      ? plan.priceMonthlyCents
      : cadence === 'SEMESTRAL'
        ? plan.priceSemestralCents
        : plan.priceAnnualCents;
  if (cadenceCents === null) return null;
  const fullPrice = plan.priceMonthlyCents * monthsByCadence[cadence];
  if (fullPrice === 0) return null;
  return Math.round(((fullPrice - cadenceCents) / fullPrice) * 100);
}

export async function fetchPlanByType(
  type: PlanType,
): Promise<PlanSummary | null> {
  const plans = await fetchActivePlans();
  return plans.find((p) => p.type === type) ?? null;
}

/** Format MXN cents as `$8,200 MXN/mes`. Pure for SSR + tests. */
export function formatPriceMXN(cents: number): string {
  const major = Math.floor(cents / 100);
  return `$${major.toLocaleString('es-MX')} MXN/mes`;
}

/** Format MXN cents as `$8,200 MXN` without the per-mes suffix. Used in
 * line-item breakdowns where the recurrence is described in surrounding copy. */
export function formatAmountMXN(cents: number): string {
  const major = Math.floor(cents / 100);
  return `$${major.toLocaleString('es-MX')} MXN`;
}

/**
 * Mexican IVA (Value Added Tax). 16% is the standard rate; reduced rates
 * apply only to border zones and specific goods which Sensu doesn't sell.
 * Stored as a fraction so `netCents * IVA_RATE` gives the IVA in cents.
 *
 * Per Juan 2026-05-18: the price shown on the plan cards is NET (`+ IVA`).
 * The actual Stripe charge is the gross amount = net + IVA. Centralizing
 * the math here so a future rate change is one line.
 */
export const IVA_RATE = 0.16;

/**
 * Net centavos for the one-time Dispositivo Angela line — the pendant
 * + correa + cargador y clip bundle. Matches the value used by the checkout
 * breakdown so the email and the start-API agree on what "device"
 * means without parsing it out of `Plan.initialFeeCents`.
 */
export const DEVICE_NET_CENTAVOS = 200_000;

/**
 * Net centavos for the Envío (shipping) line. Updated 2026-06-19 (Juan)
 * — the customer pays a $250 MXN shipping fee, gross (IVA-included).
 * Net = 250 / 1.16 = 215.52, so 21_552 cents lands at $250 gross within
 * one centavo of rounding. Was $500 from 2026-05-28 to 2026-06-19, halved
 * once the Plan A + Plan B picker rolled out to bring the upfront
 * line in tighter with the device + activation total.
 * Kept as a single constant since shipping is flat across plans and
 * cadences for now; refactor to a per-Plan column if regional rates
 * land later.
 */
export const SHIPPING_NET_CENTAVOS = 21_552;

/**
 * Free-shipping promo window (Juan 2026-06-24). Returns true when the
 * `NUCLEUS_FREE_SHIPPING_UNTIL_ISO` env value is a parseable ISO
 * datetime that is still in the future at call time. Callers should
 * substitute `0` for `SHIPPING_NET_CENTAVOS` when this is true AND
 * surface a "Envío gratis" note to the buyer so the breakdown adds
 * up without a hidden discount line.
 *
 * The check lives here (not in env.ts) so server + client callers
 * resolve the same boolean from the same import — env.ts only owns
 * the raw ISO string, this function owns the date comparison.
 */
export function isFreeShippingActive(nowMs: number, untilIso: string | null): boolean {
  if (!untilIso) return false;
  const ts = Date.parse(untilIso);
  if (!Number.isFinite(ts)) return false;
  return nowMs < ts;
}

/** IVA portion (cents) for a given net price (cents). Rounded half-up. */
export function ivaCentsForNet(netCents: number): number {
  return Math.round(netCents * IVA_RATE);
}

/** Gross price (cents) = net + IVA. This is what Stripe actually charges. */
export function grossCentsForNet(netCents: number): number {
  return netCents + ivaCentsForNet(netCents);
}

/**
 * Plan-picker pre-scope (Juan 2026-06-18, repriced 2026-07-30). Two
 * side-by-side checkout options behind `NEXT_PUBLIC_PLAN_PICKER_ENABLED`:
 *
 *   A · Inicial + mensualidad — $2,122 MXN net ($2,461 gross) initial
 *       fee covering device + activation, plus the $250 gross envío
 *       line, then $638 MXN gross/month on the existing renewal-
 *       worker cycle.
 *   B · Anual flexible        — $9,996 MXN gross single PaymentIntent
 *       on the customer's card. The buyer picks one of three payment
 *       shapes on the checkout summary card:
 *         - `single`  → one card charge of $9,996 today, no installments.
 *         - `six`     → 6 MSI (~$1,666/mo on the card statement).
 *         - `twelve`  → 12 MSI (~$833/mo on the card statement).
 *       The selected `msi` plan is passed to
 *       `stripe.confirmPayment({payment_method_options.card.installments.plan})`
 *       at confirm time. From month 13 onwards the renewal worker
 *       takes over with the normal $638 monthly cadence regardless of
 *       which payment shape the buyer picked. All-inclusive: IVA is
 *       folded into the $9,996, no separate line on checkout (Juan
 *       2026-07-30).
 *
 * Stored as net centavos so the IVA path stays consistent with every
 * other Stripe-bound amount in this file.
 */
export const PLAN_PICKER = {
  A: {
    key: 'initial_plus_monthly' as const,
    initialFeeNetCentavos: grossToNet(246_100),
    recurringCadence: 'MONTHLY' as const,
    msi: null,
  },
  B: {
    key: 'annual_flexible' as const,
    annualNetCentavos: grossToNet(999_600),
    msiOptions: {
      six: { count: 6, interval: 'month', type: 'fixed_count' },
      twelve: { count: 12, interval: 'month', type: 'fixed_count' },
    },
    handoffToMonthlyAfterMonths: 12,
  },
} as const;

/** Payment shape the buyer picks on the Plan B card. `single` means no
 *  installments (one card charge). `six` / `twelve` map to the entries
 *  in `PLAN_PICKER.B.msiOptions` and force that MSI plan on Stripe. */
export type PlanBInstallmentChoice = 'single' | 'six' | 'twelve';

/** Inverse of grossCentsForNet — given a target gross amount in cents,
 * compute the net cents that round back to it. Used by the plan-picker
 * constants where Juan stated the headline price gross. */
function grossToNet(grossCents: number): number {
  return Math.round(grossCents / (1 + IVA_RATE));
}
