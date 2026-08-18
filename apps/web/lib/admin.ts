import { redirect } from 'next/navigation';
import { Prisma } from '@prisma/client';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import {
  NON_FIXTURE_USER_FILTER,
  STRICT_NON_FIXTURE_USER_FILTER,
} from '@/lib/admin-exclusions';

/**
 * Server-side guard for admin routes. Returns the admin user's id if
 * the session is authenticated AND the row's role is ADMIN. Otherwise
 * redirects — non-authed → /login, authed-but-not-admin → /dashboard.
 *
 * Use as the first call in any server component / route under /admin.
 */
export type AdminRole = 'ADMIN' | 'CALLCENTER' | 'SALES';

export interface AdminGuardResult {
  id: string;
  email: string;
  role: AdminRole;
  /** True when the viewer should see the strict (real-customer-only)
   *  filter on every admin surface. CALLCENTER role implies true
   *  automatically; ADMIN can opt in by setting `User.callcenterMode`. */
  callcenterMode: boolean;
}

/** Per-role landing page when a narrower role attempts an ADMIN-only
 * surface. CALLCENTER → operator queue; SALES → payment-link tool;
 * everyone else → family dashboard. */
function homeForRole(role: string): string {
  if (role === 'CALLCENTER') return '/admin/operator';
  if (role === 'SALES') return '/admin/assisted-sales';
  return '/dashboard';
}

export async function requireAdmin(): Promise<AdminGuardResult> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    redirect('/login?next=%2Fadmin');
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, callcenterMode: true },
  });
  if (!user) {
    redirect('/login?next=%2Fadmin');
  }
  if (user.role !== 'ADMIN') {
    // Narrower roles can't reach ADMIN-only routes. Bounce them to
    // their per-role home (CALLCENTER → /admin/operator, SALES →
    // /admin/assisted-sales, everyone else → /dashboard).
    redirect(homeForRole(user.role));
  }
  return {
    id: user.id,
    email: user.email,
    role: 'ADMIN',
    callcenterMode: user.callcenterMode,
  };
}

/**
 * Looser admin gate that lets ADMIN and SALES pass. Use this on
 * /admin/assisted-sales (page + create-link route). CALLCENTER and
 * everyone else bounce to their own home. Returned shape matches
 * `requireAdmin` so the caller can reuse it interchangeably.
 */
export async function requireSalesOrAdmin(): Promise<AdminGuardResult> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    redirect('/login?next=%2Fadmin%2Fassisted-sales');
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, callcenterMode: true },
  });
  if (!user) {
    redirect('/login?next=%2Fadmin%2Fassisted-sales');
  }
  if (user.role !== 'ADMIN' && user.role !== 'SALES') {
    redirect(homeForRole(user.role));
  }
  return {
    id: user.id,
    email: user.email,
    role: user.role as AdminRole,
    callcenterMode: user.callcenterMode,
  };
}

/**
 * Family-side API guard. Counterpart to `requireFamilySession()` for
 * route handlers that fetch instead of render. Returns a discriminated
 * union so the caller can short-circuit with NextResponse.json():
 *
 *   const gate = await requireFamilyApiAuth();
 *   if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });
 *   const userId = gate.userId;
 *
 * Rejection codes:
 *   - 401 when no session at all (visitor or expired cookie).
 *   - 403 when the session is a CALLCENTER dispatcher — those accounts
 *     have no business mutating family data even if they technically
 *     own zero of it; principle-of-least-privilege says block outright.
 *
 * ADMIN passes — admins can still hit family routes from tooling.
 */
export async function requireFamilyApiAuth(): Promise<
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 403; body: { error: string } }
> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return { ok: false, status: 401, body: { error: 'unauthorized' } };
  }
  const role =
    (session?.user as { role?: 'USER' | 'ADMIN' | 'CALLCENTER' } | undefined)
      ?.role ?? 'USER';
  if (role === 'CALLCENTER') {
    return {
      ok: false,
      status: 403,
      body: { error: 'forbidden_callcenter_role' },
    };
  }
  return { ok: true, userId };
}

/**
 * Family-side page guard. Bounces visitors → /login (preserving the
 * intended destination via the `next` query param) and CALLCENTER
 * dispatchers → /admin/operator. ADMIN passes — they can tour the
 * family surfaces. Returns the resolved user id + role for the
 * caller's downstream queries.
 *
 * Use on every page under /profile, /geofences, /onboarding so a
 * dispatcher account cannot accidentally land on the customer-facing
 * UI (no relevant data + confusing chrome).
 */
export async function requireFamilySession(
  intendedPath: string,
): Promise<{ id: string; role: 'USER' | 'ADMIN' | 'CALLCENTER' }> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    redirect(`/login?next=${encodeURIComponent(intendedPath)}`);
  }
  const role =
    (session?.user as { role?: 'USER' | 'ADMIN' | 'CALLCENTER' } | undefined)
      ?.role ?? 'USER';
  if (role === 'CALLCENTER') {
    redirect('/admin/operator');
  }
  return { id: userId, role };
}

/**
 * Broader admin guard for routes a CALLCENTER dispatcher should
 * reach (operator queue, check-ins, fleet read). ADMINs pass too.
 * Non-admin / non-callcenter users → /dashboard. CALLCENTER always
 * sees the strict filter regardless of the per-user `callcenterMode`
 * flag, because the role itself is the strict signal.
 */
export async function requireCallcenterOrAdmin(): Promise<AdminGuardResult> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    redirect('/login?next=%2Fadmin');
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, callcenterMode: true },
  });
  if (!user) {
    redirect('/login?next=%2Fadmin');
  }
  if (user.role !== 'ADMIN' && user.role !== 'CALLCENTER') {
    redirect('/dashboard');
  }
  const role: AdminRole = user.role === 'CALLCENTER' ? 'CALLCENTER' : 'ADMIN';
  return {
    id: user.id,
    email: user.email,
    role,
    callcenterMode: role === 'CALLCENTER' ? true : user.callcenterMode,
  };
}

export interface RegistrationRow {
  subscriptionId: string;
  userId: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  planType: string;
  planName: string;
  status: string;
  amountPaidCentavos: number | null;
  purchaseDate: string | null;
  createdAt: string;
  /** Billing cadence (post 2026-05-26 pricing pivot) — null for legacy
   *  single-monthly rows from before the pivot. */
  cadence: 'MONTHLY' | 'SEMESTRAL' | 'ANNUAL' | null;
  /** ISO timestamp of the next renewal — null when cadence is null or
   *  the subscription hasn't been activated yet. */
  currentPeriodEnd: string | null;
  /** Questionnaire fields — populated when the buyer finishes
   *  /onboarding/questionnaire; null on PENDING_PAYMENT rows or
   *  pre-cutover legacy rows that never had a questionnaire. */
  dateOfBirth: string | null;
  age: number | null;
  gender: string | null;
  curp: string | null;
  userPhone: string | null;
  address: string | null;
  shippingAddress: string | null;
  housingType: string | null;
  livesAlone: boolean | null;
  medicalConditions: string | null;
  insuranceInfo: string | null;
  checkInEnabled: boolean | null;
  checkInDay: string | null;
  checkInTimeOfDay: string | null;
  questionnaireCompleted: boolean;
  /** Flattened emergency-contact roster (priority 0/1/2 — first three
   *  contacts only; CSV cannot reasonably express the variable length).
   *  Empty strings when no contact lives at that priority. */
  contact1Name: string;
  contact1Phone: string;
  contact1Relationship: string;
  contact2Name: string;
  contact2Phone: string;
  contact2Relationship: string;
  contact3Name: string;
  contact3Phone: string;
  contact3Relationship: string;
  /** Acquisition-channel tag persisted by the marketing-source cookie
   *  at checkout time (e.g. 'organic', 'fb-ad-q3', 'holiday-fathers-
   *  day-2026', 'pemex-batch'). Null when no source was present in
   *  the cookie. Juan 2026-06-25 — surfaced on /admin/registrations
   *  as a filter dropdown and a column on the CSV export. */
  signupSource: string | null;
  /** True when the buyer already has at least one UserDevice row — drives
   *  the "Asignar IMEI" cross-link on /admin/registrations. */
  hasPairedDevice: boolean;
}

export interface RegistrationFilters {
  planType?: 'ANGELA_ESENCIAL' | 'ANGELA_TOTAL';
  /** ISO date strings, inclusive bounds on Subscription.createdAt. */
  fromIso?: string;
  toIso?: string;
  /** Juan 2026-06-23 review item B.2 — when true, applies the strict
   *  non-fixture filter so demo+ and demo@ rows fall away. Default
   *  false keeps the Playwright suite happy (it asserts against the
   *  seeded demo+esencial-N rows). Juan flips it via the `?vista=real`
   *  query param and the toggle on the page header. */
  strict?: boolean;
  /** Juan 2026-06-25 — CRM segment filter. Matches User.signupSource
   *  exactly (the same value the marketing-source cookie writes at
   *  checkout time). The reserved string `'(none)'` matches rows whose
   *  signupSource is null. */
  source?: string;
}

export async function fetchRegistrations(
  filters: RegistrationFilters = {},
  page = 1,
  pageSize = 50,
): Promise<{
  rows: RegistrationRow[];
  totalRows: number;
  totalPages: number;
  page: number;
  pageSize: number;
}> {
  const { planType, fromIso, toIso, strict = false, source } = filters;
  // Source filter: '(none)' targets users with a null signupSource;
  // any other value matches the exact tag the marketing-source cookie
  // wrote at checkout time. Combined with the strict / non-fixture
  // filter through Prisma's nested-AND so neither side blocks the
  // other.
  const userWhere = strict
    ? STRICT_NON_FIXTURE_USER_FILTER
    : NON_FIXTURE_USER_FILTER;
  const sourceWhere =
    source === undefined
      ? null
      : source === '(none)'
        ? ({ signupSource: null } as Prisma.UserWhereInput)
        : ({ signupSource: source } as Prisma.UserWhereInput);
  const where: Prisma.SubscriptionWhereInput = {
    ...(fromIso || toIso
      ? {
          createdAt: {
            ...(fromIso ? { gte: new Date(fromIso) } : {}),
            ...(toIso ? { lte: new Date(toIso) } : {}),
          },
        }
      : {}),
    ...(planType ? { plan: { type: planType } } : {}),
    user: {
      is: sourceWhere ? { AND: [userWhere, sourceWhere] } : userWhere,
    },
  };
  const totalRows = await prisma.subscription.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const subs = await prisma.subscription.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          dateOfBirth: true,
          age: true,
          gender: true,
          curp: true,
          userPhone: true,
          address: true,
          shippingAddress: true,
          housingType: true,
          livesAlone: true,
          medicalConditions: true,
          insuranceInfo: true,
          checkInEnabled: true,
          checkInDay: true,
          checkInTimeOfDay: true,
          questionnaireCompleted: true,
          signupSource: true,
          emergencyContacts: {
            orderBy: { priority: 'asc' },
            select: { fullName: true, phone: true, relationship: true },
          },
          _count: { select: { devices: true } },
        },
      },
      plan: {
        select: { type: true, name: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: pageSize,
    skip: (safePage - 1) * pageSize,
  });

  return {
    rows: subs.map((s) => {
      const contacts = s.user.emergencyContacts ?? [];
      const c1 = contacts[0];
      const c2 = contacts[1];
      const c3 = contacts[2];
      return {
        subscriptionId: s.id,
        userId: s.userId,
        email: s.user.email,
        fullName: s.user.fullName,
        phone: s.user.phone,
        planType: s.plan.type,
        planName: s.plan.name,
        status: s.status,
        amountPaidCentavos: s.amountPaidCentavos,
        purchaseDate: s.purchaseDate?.toISOString() ?? null,
        createdAt: s.createdAt.toISOString(),
        cadence: (s.cadence as RegistrationRow['cadence']) ?? null,
        currentPeriodEnd: s.currentPeriodEnd?.toISOString() ?? null,
        dateOfBirth: s.user.dateOfBirth?.toISOString().slice(0, 10) ?? null,
        age: s.user.age ?? null,
        gender: s.user.gender ?? null,
        curp: s.user.curp ?? null,
        userPhone: s.user.userPhone ?? null,
        address: s.user.address ?? null,
        shippingAddress: s.user.shippingAddress ?? null,
        housingType: s.user.housingType ?? null,
        livesAlone: s.user.livesAlone ?? null,
        medicalConditions: s.user.medicalConditions ?? null,
        insuranceInfo: s.user.insuranceInfo ?? null,
        checkInEnabled: s.user.checkInEnabled ?? null,
        checkInDay: s.user.checkInDay ?? null,
        checkInTimeOfDay: s.user.checkInTimeOfDay ?? null,
        questionnaireCompleted: s.user.questionnaireCompleted,
        contact1Name: c1?.fullName ?? '',
        contact1Phone: c1?.phone ?? '',
        contact1Relationship: c1?.relationship ?? '',
        contact2Name: c2?.fullName ?? '',
        contact2Phone: c2?.phone ?? '',
        contact2Relationship: c2?.relationship ?? '',
        contact3Name: c3?.fullName ?? '',
        contact3Phone: c3?.phone ?? '',
        contact3Relationship: c3?.relationship ?? '',
        signupSource: s.user.signupSource ?? null,
        hasPairedDevice: (s.user._count?.devices ?? 0) > 0,
      };
    }),
    totalRows,
    totalPages,
    page: safePage,
    pageSize,
  };
}

const CSV_COLUMNS: Array<keyof RegistrationRow> = [
  // Subscription + billing
  'subscriptionId',
  'email',
  'phone',
  'planType',
  'planName',
  'status',
  'amountPaidCentavos',
  'cadence',
  'currentPeriodEnd',
  'purchaseDate',
  'createdAt',
  'questionnaireCompleted',
  // Senior / questionnaire fields
  'fullName',
  'dateOfBirth',
  'age',
  'gender',
  'curp',
  'userPhone',
  'address',
  'shippingAddress',
  'housingType',
  'livesAlone',
  'medicalConditions',
  'insuranceInfo',
  'checkInEnabled',
  'checkInDay',
  'checkInTimeOfDay',
  // Emergency contacts (first three by priority)
  'contact1Name',
  'contact1Phone',
  'contact1Relationship',
  'contact2Name',
  'contact2Phone',
  'contact2Relationship',
  'contact3Name',
  'contact3Phone',
  'contact3Relationship',
  // CRM source tag (Juan 2026-06-25). Lets accounting + marketing
  // segment customers by acquisition channel without opening the DB.
  'signupSource',
];

/**
 * Render rows as CSV. Quotes any cell that contains a comma, quote, or
 * newline; doubles internal quotes per RFC 4180. Emits BOM so Excel on
 * Windows opens the file as UTF-8 instead of mojibake.
 */
/**
 * Per-subscription detail view (Phase C #2, 2026-06-10).
 *
 * Read-only superset of the registrations row + paired-device roster +
 * promo redemption summary + a Stripe customer URL for one-click hop
 * into Juan's Stripe dashboard. Manual override hooks (refund / pause
 * / change plan) come in a subsequent step alongside a PaymentFailure
 * model + invoice.* webhook handlers.
 */
export interface SubscriptionDeviceRow {
  eviewDeviceId: string;
  label: string | null;
  role: string;
  isPrimary: boolean;
  pairedAt: string;
}

export interface SubscriptionPaymentRow {
  id: string;
  createdAt: string;
  amountCentavos: number;
  currency: string;
  status: string;
  paymentMethodLast4: string | null;
  paymentMethodBrand: string | null;
  declineReason: string | null;
  refundedCentavos: number;
}

export interface SubscriptionRiskSignals {
  failedPaymentCount30d: number;
  failedPaymentCountAllTime: number;
  hasOpenFailure: boolean;
  daysUntilRenewal: number | null;
  hasPastDueStatus: boolean;
  hasCancelledStatus: boolean;
  totalRefundedCentavos: number;
}

export interface SubscriptionDetail {
  subscriptionId: string;
  userId: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  signupSource: string | null;
  stripeCustomerId: string | null;
  planType: string;
  planName: string;
  status: string;
  cadence: 'MONTHLY' | 'SEMESTRAL' | 'ANNUAL' | null;
  amountPaidCentavos: number | null;
  initialFeePaidCentavos: number | null;
  currentPeriodEnd: string | null;
  purchaseDate: string | null;
  startDate: string | null;
  shippedAt: string | null;
  activatedAt: string | null;
  createdAt: string;
  /** Promo redemption summary — null when no code was applied. */
  promoCode: string | null;
  promoChannel: string | null;
  discountAmountCentavos: number | null;
  /** Every UserDevice row keyed to this subscription's User. */
  devices: SubscriptionDeviceRow[];
  /** Stripe payment history (last 20 intents). null when Stripe lookup fails. */
  paymentHistory: SubscriptionPaymentRow[] | null;
  /** Derived churn-risk signals so the dispatcher does not have to compute. */
  riskSignals: SubscriptionRiskSignals;
}

export async function fetchSubscriptionDetail(
  subscriptionId: string,
): Promise<SubscriptionDetail | null> {
  const sub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          signupSource: true,
          stripeCustomerId: true,
          devices: {
            orderBy: { assignedAt: 'asc' },
            select: {
              eviewDeviceId: true,
              label: true,
              role: true,
              isPrimary: true,
              assignedAt: true,
            },
          },
        },
      },
      plan: { select: { type: true, name: true } },
      promoCode: { select: { code: true, channel: true } },
    },
  });
  if (!sub) return null;

  const paymentHistory = await fetchPaymentHistory(sub.user.stripeCustomerId);
  const riskSignals = computeRiskSignals({
    status: sub.status,
    currentPeriodEnd: sub.currentPeriodEnd,
    history: paymentHistory ?? [],
  });

  return {
    subscriptionId: sub.id,
    userId: sub.userId,
    email: sub.user.email,
    fullName: sub.user.fullName,
    phone: sub.user.phone,
    signupSource: sub.user.signupSource,
    stripeCustomerId: sub.user.stripeCustomerId,
    planType: sub.plan.type,
    planName: sub.plan.name,
    status: sub.status,
    cadence: (sub.cadence as SubscriptionDetail['cadence']) ?? null,
    amountPaidCentavos: sub.amountPaidCentavos,
    initialFeePaidCentavos: sub.initialFeePaidCentavos ?? null,
    currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
    purchaseDate: sub.purchaseDate?.toISOString() ?? null,
    startDate: sub.startDate?.toISOString() ?? null,
    shippedAt: sub.shippedAt?.toISOString() ?? null,
    activatedAt: sub.activatedAt?.toISOString() ?? null,
    createdAt: sub.createdAt.toISOString(),
    promoCode: sub.promoCode?.code ?? null,
    promoChannel: sub.promoCode?.channel ?? null,
    discountAmountCentavos: sub.discountAmountCentavos ?? null,
    devices: sub.user.devices.map((d) => ({
      eviewDeviceId: d.eviewDeviceId,
      label: d.label,
      role: d.role,
      isPrimary: d.isPrimary,
      pairedAt: d.assignedAt.toISOString(),
    })),
    paymentHistory,
    riskSignals,
  };
}

/**
 * Pulls the last 20 PaymentIntents from Stripe for a customer. Returns
 * null when there is no Stripe customer yet (account exists but never
 * paid) or when Stripe lookup fails — the page renders an "no Stripe
 * data" panel in either case, so the dispatcher is never blocked.
 */
async function fetchPaymentHistory(
  stripeCustomerId: string | null,
): Promise<SubscriptionPaymentRow[] | null> {
  if (!stripeCustomerId) return null;
  try {
    const { stripe } = await import('@/lib/stripe');
    const list = await stripe().paymentIntents.list({
      customer: stripeCustomerId,
      limit: 20,
      expand: ['data.latest_charge'],
    });
    return list.data.map((pi) => {
      const latest = (pi.latest_charge ?? null) as {
        payment_method_details?: {
          card?: { last4?: string; brand?: string };
        };
        amount_refunded?: number;
        outcome?: { reason?: string | null; seller_message?: string | null };
      } | string | null;
      const charge =
        latest && typeof latest === 'object' ? latest : null;
      const declineReason =
        pi.last_payment_error?.message ??
        pi.last_payment_error?.code ??
        charge?.outcome?.reason ??
        null;
      return {
        id: pi.id,
        createdAt: new Date(pi.created * 1000).toISOString(),
        amountCentavos: pi.amount,
        currency: pi.currency.toUpperCase(),
        status: pi.status,
        paymentMethodLast4: charge?.payment_method_details?.card?.last4 ?? null,
        paymentMethodBrand: charge?.payment_method_details?.card?.brand ?? null,
        declineReason,
        refundedCentavos: charge?.amount_refunded ?? 0,
      };
    });
  } catch (err) {
    console.error('[admin] stripe payment history failed', err);
    return null;
  }
}

function computeRiskSignals(args: {
  status: string;
  currentPeriodEnd: Date | null;
  history: SubscriptionPaymentRow[];
}): SubscriptionRiskSignals {
  const FAILURE_STATUSES = new Set([
    'requires_payment_method',
    'requires_action',
    'canceled',
  ]);
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  let failedPaymentCount30d = 0;
  let failedPaymentCountAllTime = 0;
  let hasOpenFailure = false;
  let totalRefundedCentavos = 0;
  for (const row of args.history) {
    if (FAILURE_STATUSES.has(row.status) || row.declineReason) {
      failedPaymentCountAllTime++;
      if (new Date(row.createdAt).getTime() >= thirtyDaysAgo) {
        failedPaymentCount30d++;
      }
      if (row.status === 'requires_payment_method' || row.status === 'requires_action') {
        hasOpenFailure = true;
      }
    }
    totalRefundedCentavos += row.refundedCentavos;
  }
  const daysUntilRenewal = args.currentPeriodEnd
    ? Math.ceil((args.currentPeriodEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
    : null;
  return {
    failedPaymentCount30d,
    failedPaymentCountAllTime,
    hasOpenFailure,
    daysUntilRenewal,
    hasPastDueStatus: args.status === 'PAST_DUE',
    hasCancelledStatus: args.status === 'CANCELLED',
    totalRefundedCentavos,
  };
}

export function rowsToCsv(rows: RegistrationRow[]): string {
  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (/[",\n\r]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const header = CSV_COLUMNS.join(',');
  const body = rows.map((r) => CSV_COLUMNS.map((c) => escape(r[c])).join(',')).join('\n');
  return `﻿${header}\n${body}\n`;
}
