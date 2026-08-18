import { prisma } from '@/lib/db';
import {
  EXCLUDED_DEVICE_PREFIXES,
  NON_FIXTURE_USER_FILTER,
  STRICT_EXCLUDED_DEVICE_PREFIXES,
} from '@/lib/admin-exclusions';

// Combined device-prefix exclusions for admin business surface — hides
// every test fixture identifier (E2E-, e2e-, STEP6, EV-DEMO, VIS-, etc.)
// so real fleet numbers are not contaminated.
const ALL_EXCLUDED_DEVICE_PREFIXES = [
  ...EXCLUDED_DEVICE_PREFIXES,
  ...STRICT_EXCLUDED_DEVICE_PREFIXES,
];

/**
 * Admin business-dashboard aggregators (2026-07-11).
 *
 * One-shot queries backing every card on /admin/business. Each fetch
 * function returns a fully-typed payload the card component renders.
 * All queries apply NON_FIXTURE_USER_FILTER (or the equivalent SQL
 * WHERE clauses) so Playwright / debug / managed-worker rows never
 * leak into the numbers Juan sees.
 *
 * Prisma is the primary ORM; a few queries drop to $queryRaw where
 * generate_series or CASE-based bucketing beats a Prisma round-trip.
 */

// ============================================
// MRR — chart 1
// ============================================

export interface MrrPoint {
  monthStart: string; // ISO YYYY-MM-01
  mrrMxn: number; // pesos, not centavos
}

export interface MrrPayload {
  series: MrrPoint[];
  currentMonthMxn: number;
  previousMonthMxn: number;
  deltaPct: number | null; // null when previous month is 0
}

/**
 * Monthly recurring revenue over the last 12 months.
 *
 * MRR at month M = sum over subscriptions that were "on the books" at
 * end-of-month M of their cadence-normalised monthly cost:
 *   - MONTHLY   → amountPaidCentavos
 *   - SEMESTRAL → amountPaidCentavos / 6
 *   - ANNUAL    → amountPaidCentavos / 12
 *
 * A subscription is "on the books" at end-of-M when startDate ≤ end-of-M
 * AND (endDate is null OR endDate > start-of-M) AND status is not
 * PENDING_PAYMENT or CANCELLED. PAST_DUE + PAUSED still count as
 * on-the-books revenue for MRR purposes (they either recover or churn).
 *
 * Fixture users are excluded via a NOT LIKE join on User.email since
 * the Prisma relation join doesn't play with the raw generate_series
 * query.
 */
export async function fetchMrrSeries(): Promise<MrrPayload> {
  const rows = await prisma.$queryRaw<
    Array<{ month_start: Date; mrr_centavos: bigint }>
  >`
    WITH months AS (
      SELECT generate_series(
        date_trunc('month', NOW() - INTERVAL '11 months'),
        date_trunc('month', NOW()),
        INTERVAL '1 month'
      ) AS month_start
    )
    SELECT
      m.month_start,
      COALESCE(SUM(
        CASE s.cadence
          WHEN 'MONTHLY'   THEN s."amountPaidCentavos"
          WHEN 'SEMESTRAL' THEN s."amountPaidCentavos" / 6
          WHEN 'ANNUAL'    THEN s."amountPaidCentavos" / 12
          ELSE 0
        END
      ), 0)::bigint AS mrr_centavos
    FROM months m
    LEFT JOIN "Subscription" s ON
      s.status IN ('ACTIVE', 'PAST_DUE', 'PAUSED') AND
      s."startDate" IS NOT NULL AND
      s."startDate" <= (m.month_start + INTERVAL '1 month') AND
      (s."endDate" IS NULL OR s."endDate" > m.month_start) AND
      s."amountPaidCentavos" IS NOT NULL
    LEFT JOIN "User" u ON u.id = s."userId"
    WHERE u.id IS NULL OR (
      u.kind = 'FAMILY' AND
      u.email NOT LIKE '%@nucleus-test.local' AND
      u.email NOT LIKE '%@sensu-debug.local' AND
      u.email NOT LIKE '%@managed.sensu.internal'
    )
    GROUP BY m.month_start
    ORDER BY m.month_start;
  `;

  const series: MrrPoint[] = rows.map((r) => ({
    monthStart: r.month_start.toISOString().slice(0, 10),
    mrrMxn: Math.round(Number(r.mrr_centavos) / 100),
  }));

  const currentMonthMxn = series[series.length - 1]?.mrrMxn ?? 0;
  const previousMonthMxn = series[series.length - 2]?.mrrMxn ?? 0;
  const deltaPct =
    previousMonthMxn === 0
      ? null
      : ((currentMonthMxn - previousMonthMxn) / previousMonthMxn) * 100;

  return { series, currentMonthMxn, previousMonthMxn, deltaPct };
}

// ============================================
// Active vs churned — chart 2
// ============================================

export interface ChurnPayload {
  active: number;
  churnedThisMonth: number;
  netChange: number;
  churnRatePct: number; // 0..100
}

/**
 * Active count = subscriptions with revenue on the books today.
 * Churned this month = subscriptions that flipped to CANCELLED this
 * calendar month (identified by updatedAt + status = CANCELLED, since
 * Subscription has no explicit cancelledAt field; see
 * lib/admin-reporting.ts for the same pattern).
 */
export async function fetchChurnSnapshot(): Promise<ChurnPayload> {
  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const nextMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  );

  const [active, churnedThisMonth] = await Promise.all([
    prisma.subscription.count({
      where: {
        status: { in: ['ACTIVE', 'PAST_DUE', 'PAUSED'] },
        startDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gt: now } }],
        user: { is: NON_FIXTURE_USER_FILTER },
      },
    }),
    prisma.subscription.count({
      where: {
        status: 'CANCELLED',
        updatedAt: { gte: monthStart, lt: nextMonthStart },
        user: { is: NON_FIXTURE_USER_FILTER },
      },
    }),
  ]);

  const denom = active + churnedThisMonth;
  const churnRatePct = denom === 0 ? 0 : (churnedThisMonth / denom) * 100;
  const netChange = active - churnedThisMonth;

  return { active, churnedThisMonth, netChange, churnRatePct };
}

// ============================================
// Funnel conversion — chart 3
// ============================================

export interface FunnelStage {
  slug: string;
  label: string;
  count: number;
  pctOfStart: number; // 0..100
  pctOfPrev: number; // 0..100
}

export interface FunnelPayload {
  stages: FunnelStage[];
  note: string;
}

/**
 * Six-stage buyer funnel from checkout to a device that phoned home.
 *
 * We do NOT count top-of-funnel (pageviews → checkout) because that
 * data lives on the marketing site (Lovable) and is not wired into
 * Nucleus. The card copy calls this out explicitly.
 */
export async function fetchFunnel(): Promise<FunnelPayload> {
  const nonFixtureUser = { user: { is: NON_FIXTURE_USER_FILTER } };

  const [
    checkoutStarted,
    paymentCollected,
    activeStatus,
    questionnaireCompleted,
    devicePaired,
    telemetrySeenRows,
  ] = await Promise.all([
    prisma.subscription.count({ where: { ...nonFixtureUser } }),
    prisma.subscription.count({
      where: {
        stripePaymentIntentId: { not: null },
        ...nonFixtureUser,
      },
    }),
    prisma.subscription.count({
      where: {
        status: { in: ['ACTIVE', 'PAST_DUE'] },
        ...nonFixtureUser,
      },
    }),
    prisma.user.count({
      where: {
        ...NON_FIXTURE_USER_FILTER,
        questionnaireCompleted: true,
        subscriptions: {
          some: { status: { in: ['ACTIVE', 'PAST_DUE'] } },
        },
      },
    }),
    prisma.user.count({
      where: {
        ...NON_FIXTURE_USER_FILTER,
        subscriptions: {
          some: { status: { in: ['ACTIVE', 'PAST_DUE'] } },
        },
        devices: { some: { role: 'MASTER' } },
      },
    }),
    prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT COUNT(DISTINCT u.id)::bigint AS n
      FROM "User" u
      JOIN "UserDevice" ud ON ud."userId" = u.id AND ud.role = 'MASTER'
      JOIN "EviewEvent" e ON e."eviewDeviceId" = ud."eviewDeviceId"
      JOIN "Subscription" s ON s."userId" = u.id
        AND s.status IN ('ACTIVE', 'PAST_DUE')
      WHERE u.kind = 'FAMILY'
        AND u.email NOT LIKE '%@nucleus-test.local'
        AND u.email NOT LIKE '%@sensu-debug.local'
        AND u.email NOT LIKE '%@managed.sensu.internal'
        AND e.timestamp >= NOW() - INTERVAL '7 days';
    `,
  ]);

  const telemetrySeen = Number(telemetrySeenRows[0]?.n ?? 0);

  const raw = [
    { slug: 'checkout', label: 'Empezó el checkout', count: checkoutStarted },
    { slug: 'paid', label: 'Pagó', count: paymentCollected },
    { slug: 'active', label: 'Servicio activo', count: activeStatus },
    { slug: 'questionnaire', label: 'Completó cuestionario', count: questionnaireCompleted },
    { slug: 'device', label: 'Vinculó dispositivo', count: devicePaired },
    { slug: 'live', label: 'Botón en línea', count: telemetrySeen },
  ];

  const start = raw[0]?.count ?? 0;
  const stages: FunnelStage[] = raw.map((r, i) => {
    const prev = i === 0 ? r.count : raw[i - 1]!.count;
    return {
      slug: r.slug,
      label: r.label,
      count: r.count,
      pctOfStart: start === 0 ? 0 : (r.count / start) * 100,
      pctOfPrev: prev === 0 ? 0 : (r.count / prev) * 100,
    };
  });

  return {
    stages,
    note: 'El embudo empieza en checkout. Añadir datos del sitio de marketing para ver la parte superior.',
  };
}

// ============================================
// Promo code performance — chart 4
// ============================================

export interface PromoRow {
  code: string;
  label: string;
  channel: string;
  redemptions: number;
  mxnDiscounted: number;
  grossRevenue: number;
  netRevenue: number;
}

export interface PromoPayload {
  rows: PromoRow[];
  totalRedemptions: number;
  totalGrossRevenue: number;
  totalMxnDiscounted: number;
}

/**
 * Per-code redemption count + revenue attribution. Uses
 * Subscription.discountAmountCentavos (the actual applied discount,
 * persisted at redemption) rather than deriving from percentOffBps —
 * more accurate when rate-cards change post-redemption.
 *
 * Fixture users are excluded on the joined User row via NOT LIKE.
 */
export async function fetchPromoPerformance(): Promise<PromoPayload> {
  const rowsRaw = await prisma.$queryRaw<
    Array<{
      code: string;
      label: string;
      channel: string;
      redemptions: bigint;
      mxn_discounted_centavos: bigint;
      gross_revenue_centavos: bigint;
    }>
  >`
    SELECT
      p.code,
      p.label,
      p.channel,
      COUNT(DISTINCT s.id)::bigint AS redemptions,
      COALESCE(SUM(s."discountAmountCentavos"), 0)::bigint AS mxn_discounted_centavos,
      COALESCE(SUM(s."amountPaidCentavos"), 0)::bigint    AS gross_revenue_centavos
    FROM "PromoCode" p
    LEFT JOIN "Subscription" s ON s."promoCodeId" = p.code
    LEFT JOIN "User" u          ON u.id           = s."userId"
    WHERE s.id IS NULL OR (
      u.kind = 'FAMILY' AND
      u.email NOT LIKE '%@nucleus-test.local' AND
      u.email NOT LIKE '%@sensu-debug.local' AND
      u.email NOT LIKE '%@managed.sensu.internal'
    )
    GROUP BY p.code, p.label, p.channel
    ORDER BY redemptions DESC, mxn_discounted_centavos DESC;
  `;

  const rows: PromoRow[] = rowsRaw.map((r) => {
    const gross = Math.round(Number(r.gross_revenue_centavos) / 100);
    const discounted = Math.round(Number(r.mxn_discounted_centavos) / 100);
    return {
      code: r.code,
      label: r.label,
      channel: r.channel,
      redemptions: Number(r.redemptions),
      mxnDiscounted: discounted,
      grossRevenue: gross,
      netRevenue: gross - discounted,
    };
  });

  const totalRedemptions = rows.reduce((n, r) => n + r.redemptions, 0);
  const totalGrossRevenue = rows.reduce((n, r) => n + r.grossRevenue, 0);
  const totalMxnDiscounted = rows.reduce((n, r) => n + r.mxnDiscounted, 0);

  return { rows, totalRedemptions, totalGrossRevenue, totalMxnDiscounted };
}

// ============================================
// Sales mix — chart 5
// ============================================

export type SalesMixBucket =
  | 'assisted_sale'
  | 'referral'
  | 'partnership'
  | 'self_serve';

export interface SalesMixSlice {
  bucket: SalesMixBucket;
  label: string;
  userCount: number;
  subscriptionCount: number;
  revenueMxn: number;
}

export interface SalesMixPayload {
  slices: SalesMixSlice[];
  totalSubscriptions: number;
  totalRevenueMxn: number;
}

const BUCKET_LABEL: Record<SalesMixBucket, string> = {
  assisted_sale: 'Venta asistida',
  referral: 'Referidos',
  partnership: 'Alianzas',
  self_serve: 'Autoservicio',
};

/**
 * User signup-source split for THIS calendar month:
 *   - `assisted_sale`   — WhatsApp Payment Link rail
 *   - `referral*`       — codes from referral program
 *   - `partnership*` / pemex / medtronic — B2B partner sites
 *   - everything else (null included) — direct self-serve
 */
export async function fetchSalesMix(): Promise<SalesMixPayload> {
  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const nextMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  );

  const raw = await prisma.$queryRaw<
    Array<{
      bucket: string;
      user_count: bigint;
      subscription_count: bigint;
      revenue_centavos: bigint;
    }>
  >`
    SELECT
      CASE
        WHEN u."signupSource" = 'assisted_sale' THEN 'assisted_sale'
        WHEN u."signupSource" LIKE 'referral%'  THEN 'referral'
        WHEN u."signupSource" LIKE 'partnership%'
          OR u."signupSource" IN ('pemex', 'medtronic') THEN 'partnership'
        ELSE 'self_serve'
      END AS bucket,
      COUNT(DISTINCT u.id)::bigint             AS user_count,
      COUNT(DISTINCT s.id)::bigint             AS subscription_count,
      COALESCE(SUM(s."amountPaidCentavos"), 0)::bigint AS revenue_centavos
    FROM "User" u
    JOIN "Subscription" s ON s."userId" = u.id
    WHERE s."createdAt" >= ${monthStart}
      AND s."createdAt" <  ${nextMonthStart}
      AND u.kind = 'FAMILY'
      AND u.email NOT LIKE '%@nucleus-test.local'
      AND u.email NOT LIKE '%@sensu-debug.local'
      AND u.email NOT LIKE '%@managed.sensu.internal'
    GROUP BY 1
    ORDER BY subscription_count DESC;
  `;

  const byBucket = new Map<SalesMixBucket, SalesMixSlice>();
  for (const b of ['assisted_sale', 'referral', 'partnership', 'self_serve'] as SalesMixBucket[]) {
    byBucket.set(b, {
      bucket: b,
      label: BUCKET_LABEL[b],
      userCount: 0,
      subscriptionCount: 0,
      revenueMxn: 0,
    });
  }
  for (const r of raw) {
    const key = r.bucket as SalesMixBucket;
    const existing = byBucket.get(key);
    if (!existing) continue;
    existing.userCount = Number(r.user_count);
    existing.subscriptionCount = Number(r.subscription_count);
    existing.revenueMxn = Math.round(Number(r.revenue_centavos) / 100);
  }

  const slices = Array.from(byBucket.values());
  const totalSubscriptions = slices.reduce(
    (n, s) => n + s.subscriptionCount,
    0,
  );
  const totalRevenueMxn = slices.reduce((n, s) => n + s.revenueMxn, 0);

  return { slices, totalSubscriptions, totalRevenueMxn };
}

// ============================================
// Device inventory age histogram — chart 6
// ============================================

export type AgeBucketKey =
  | '<1h'
  | '1-24h'
  | '1-7d'
  | '7-30d'
  | '>30d'
  | 'never';

export interface AgeBucket {
  bucket: AgeBucketKey;
  label: string;
  n: number;
}

export interface InventoryAgePayload {
  buckets: AgeBucket[];
  totalActive: number;
}

const AGE_LABEL: Record<AgeBucketKey, string> = {
  '<1h': 'Últimos 60 min',
  '1-24h': 'Últimas 24 h',
  '1-7d': 'Últimos 7 días',
  '7-30d': '7 a 30 días',
  '>30d': 'Más de 30 días',
  never: 'Nunca reportó',
};

/**
 * Bucketed distribution of "days since last device heartbeat" across
 * the fleet. Excludes every synthetic device prefix pulled from
 * lib/admin-exclusions so demo / test / staging devices never inflate
 * the numbers Juan sees.
 */
export async function fetchInventoryAge(): Promise<InventoryAgePayload> {
  // Fetch device rows via Prisma so we can apply the prefix filter in
  // TypeScript against the known-string list, then a single raw query
  // for the last-seen bucket assignment on the surviving deviceIds.
  const devices = await prisma.device.findMany({
    where: {
      isActive: true,
      AND: ALL_EXCLUDED_DEVICE_PREFIXES.map((prefix) => ({
        deviceId: { not: { startsWith: prefix } },
      })),
    },
    select: { deviceId: true },
  });
  const deviceIds = devices.map((d) => d.deviceId);

  if (deviceIds.length === 0) {
    return {
      buckets: (
        ['<1h', '1-24h', '1-7d', '7-30d', '>30d', 'never'] as AgeBucketKey[]
      ).map((k) => ({ bucket: k, label: AGE_LABEL[k], n: 0 })),
      totalActive: 0,
    };
  }

  const rows = await prisma.$queryRaw<
    Array<{ bucket: AgeBucketKey; n: bigint }>
  >`
    WITH last_seen AS (
      SELECT
        d."deviceId",
        MAX(e.timestamp) AS last_event
      FROM "Device" d
      LEFT JOIN "EviewEvent" e ON e."eviewDeviceId" = d."deviceId"
      WHERE d."deviceId" = ANY(${deviceIds}::text[])
      GROUP BY d."deviceId"
    )
    SELECT
      CASE
        WHEN last_event IS NULL                         THEN 'never'
        WHEN last_event > NOW() - INTERVAL '1 hour'     THEN '<1h'
        WHEN last_event > NOW() - INTERVAL '24 hours'   THEN '1-24h'
        WHEN last_event > NOW() - INTERVAL '7 days'     THEN '1-7d'
        WHEN last_event > NOW() - INTERVAL '30 days'    THEN '7-30d'
        ELSE '>30d'
      END::text AS bucket,
      COUNT(*)::bigint AS n
    FROM last_seen
    GROUP BY 1;
  `;

  const byBucket = new Map<AgeBucketKey, number>();
  for (const k of ['<1h', '1-24h', '1-7d', '7-30d', '>30d', 'never'] as AgeBucketKey[]) {
    byBucket.set(k, 0);
  }
  for (const r of rows) {
    byBucket.set(r.bucket, Number(r.n));
  }

  const buckets: AgeBucket[] = (
    ['<1h', '1-24h', '1-7d', '7-30d', '>30d', 'never'] as AgeBucketKey[]
  ).map((k) => ({
    bucket: k,
    label: AGE_LABEL[k],
    n: byBucket.get(k) ?? 0,
  }));

  const totalActive = buckets.reduce((n, b) => n + b.n, 0);

  return { buckets, totalActive };
}

// ============================================
// LocTube health — chart 7
// ============================================

export interface LocTubeHealthPayload {
  totalDevices: number;
  activeLast24h: number;
  pctHealthy: number; // 0..100, one decimal
  tone: 'healthy' | 'warning' | 'critical';
}

/**
 * Percentage of the real (non-fixture) fleet that phoned home in the
 * last 24 hours. Anything ≥95% is healthy (emerald), 80–94% warning
 * (amber), <80% critical (rose).
 */
export async function fetchLocTubeHealth(): Promise<LocTubeHealthPayload> {
  const devices = await prisma.device.findMany({
    where: {
      isActive: true,
      AND: ALL_EXCLUDED_DEVICE_PREFIXES.map((prefix) => ({
        deviceId: { not: { startsWith: prefix } },
      })),
    },
    select: { deviceId: true },
  });
  const deviceIds = devices.map((d) => d.deviceId);
  const totalDevices = deviceIds.length;

  if (totalDevices === 0) {
    return {
      totalDevices: 0,
      activeLast24h: 0,
      pctHealthy: 0,
      tone: 'critical',
    };
  }

  const rows = await prisma.$queryRaw<Array<{ n: bigint }>>`
    SELECT COUNT(DISTINCT e."eviewDeviceId")::bigint AS n
    FROM "EviewEvent" e
    WHERE e."eviewDeviceId" = ANY(${deviceIds}::text[])
      AND e.timestamp > NOW() - INTERVAL '24 hours';
  `;
  const activeLast24h = Number(rows[0]?.n ?? 0);

  const pctHealthy = Math.round((activeLast24h / totalDevices) * 1000) / 10;
  const tone: LocTubeHealthPayload['tone'] =
    pctHealthy >= 95 ? 'healthy' : pctHealthy >= 80 ? 'warning' : 'critical';

  return { totalDevices, activeLast24h, pctHealthy, tone };
}

// ============================================
// Top drop-off points — chart 8
// ============================================

export interface DropOffStep {
  slug: string;
  label: string;
  count: number;
}

export interface DropOffPayload {
  steps: DropOffStep[];
  totalIncomplete: number;
}

/**
 * Where users are stuck in the buyer journey right now. Five buckets,
 * ordered by biggest-first at render time. Answers: which step should
 * Juan focus on to recover the most money?
 */
export async function fetchDropOff(): Promise<DropOffPayload> {
  const nonFixtureUser = { user: { is: NON_FIXTURE_USER_FILTER } };

  const [
    checkoutNoPI,
    piNoActive,
    activeNoQuestionnaire,
    questionnaireNoDevice,
    deviceSilentRows,
  ] = await Promise.all([
    prisma.subscription.count({
      where: {
        stripePaymentIntentId: null,
        status: 'PENDING_PAYMENT',
        ...nonFixtureUser,
      },
    }),
    prisma.subscription.count({
      where: {
        stripePaymentIntentId: { not: null },
        status: 'PENDING_PAYMENT',
        ...nonFixtureUser,
      },
    }),
    prisma.user.count({
      where: {
        ...NON_FIXTURE_USER_FILTER,
        questionnaireCompleted: false,
        subscriptions: {
          some: { status: { in: ['ACTIVE', 'PAST_DUE'] } },
        },
      },
    }),
    prisma.user.count({
      where: {
        ...NON_FIXTURE_USER_FILTER,
        questionnaireCompleted: true,
        subscriptions: {
          some: { status: { in: ['ACTIVE', 'PAST_DUE'] } },
        },
        devices: { none: { role: 'MASTER' } },
      },
    }),
    prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT COUNT(DISTINCT u.id)::bigint AS n
      FROM "User" u
      JOIN "UserDevice" ud ON ud."userId" = u.id AND ud.role = 'MASTER'
      JOIN "Subscription" s ON s."userId" = u.id
        AND s.status IN ('ACTIVE', 'PAST_DUE')
      LEFT JOIN "EviewEvent" e ON e."eviewDeviceId" = ud."eviewDeviceId"
        AND e.timestamp > NOW() - INTERVAL '30 days'
      WHERE u.kind = 'FAMILY'
        AND u.email NOT LIKE '%@nucleus-test.local'
        AND u.email NOT LIKE '%@sensu-debug.local'
        AND u.email NOT LIKE '%@managed.sensu.internal'
        AND e.id IS NULL;
    `,
  ]);

  const deviceSilent = Number(deviceSilentRows[0]?.n ?? 0);

  const steps: DropOffStep[] = [
    {
      slug: 'checkout-no-pi',
      label: 'Empezó checkout sin pagar',
      count: checkoutNoPI,
    },
    {
      slug: 'pi-no-active',
      label: 'Pago iniciado, no activo',
      count: piNoActive,
    },
    {
      slug: 'active-no-questionnaire',
      label: 'Activo sin cuestionario',
      count: activeNoQuestionnaire,
    },
    {
      slug: 'questionnaire-no-device',
      label: 'Cuestionario, sin dispositivo',
      count: questionnaireNoDevice,
    },
    {
      slug: 'device-silent',
      label: 'Dispositivo silencioso 30 días',
      count: deviceSilent,
    },
  ]
    .filter((s) => s.count >= 0)
    .sort((a, b) => b.count - a.count);

  const totalIncomplete = steps.reduce((n, s) => n + s.count, 0);

  return { steps, totalIncomplete };
}

