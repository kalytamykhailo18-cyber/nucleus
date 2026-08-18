import { prisma } from '@/lib/db';
import { ALERT_EVENT_TYPES } from '@/lib/alerts';
import { userFilterFor, devicePrefixesFor } from '@/lib/admin-exclusions';

/**
 * Admin reporting aggregator (Phase C #5, 2026-06-15).
 *
 * One server-side call computes every number the /admin/reporting page
 * needs. Everything derives from existing tables — no new schema,
 * Stripe is the source of truth for revenue.
 *
 *   - **MRR-equivalent**: sum of active subscription monthly cost
 *     (cadence-normalized — semestral / 6, annual / 12).
 *   - **Active / pending / past-due / cancelled** subscription counts.
 *   - **30-day signup count + delta vs the prior 30 days**.
 *   - **30-day churn rate**: cancelled-30d / active-30d-ago.
 *   - **Channel attribution**: User.signupSource → count.
 *   - **Plan distribution**: ACTIVE subscriptions grouped by plan.
 *   - **Alert volume 30d**: total alert events across the fleet.
 *   - **Operator activity 30d**: OperatorAction rows by kind.
 */

export interface ReportingSnapshot {
  generatedAt: string;
  mrrEquivalentCentavos: number;
  subscriptionCounts: {
    active: number;
    pendingPayment: number;
    pastDue: number;
    cancelled: number;
  };
  signups30d: number;
  signups60dPrior: number;
  churnRate30d: number;
  channelAttribution: Array<{ source: string; count: number }>;
  planDistribution: Array<{ planName: string; count: number }>;
  alertVolume30d: number;
  operatorActivity30d: Array<{ kind: string; count: number }>;
  totalUsers: number;
  totalCompanies: number;
  managedFleetCompanies: number;
  contactInquiries30d: number;
  referrals: {
    /** Referral rows created in the last 30 days, irrespective of status. */
    created30d: number;
    /** Status counts across the full Referral table (all-time). */
    statusCounts: {
      pending: number;
      redeemed: number;
      expired: number;
    };
    /** Credit accrued across REDEEMED rows (all-time, cents). */
    creditAccruedCentavos: number;
    /**
     * Top referrers by REDEEMED count, all-time. Capped at 10 rows
     * so the panel stays digestible.
     */
    topReferrers: Array<{
      userId: string;
      email: string;
      fullName: string | null;
      redeemedCount: number;
      creditCentavos: number;
    }>;
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function fetchReportingSnapshot(
  options: { callcenterMode?: boolean } = {},
): Promise<ReportingSnapshot> {
  const now = Date.now();
  const thirtyDaysAgo = new Date(now - 30 * DAY_MS);
  const sixtyDaysAgo = new Date(now - 60 * DAY_MS);

  // Match the rest of the admin platform: lenient viewers (specs +
  // demo@sensu.com.mx) see fixture-tainted counts; call-center /
  // production admins (Juan 2026-06-17) see only real customer data.
  const userWhere = userFilterFor(options.callcenterMode ?? false);
  const subUserWhere = { user: userWhere };
  // EviewEvent rows from synthetic device IDs are tagged by prefix.
  // Build the exclusion list once and reuse for the alert count.
  const excludedDevicePrefixes = devicePrefixesFor(
    options.callcenterMode ?? false,
  );
  const deviceExclusionWhere = {
    AND: excludedDevicePrefixes.map((prefix) => ({
      eviewDeviceId: { not: { startsWith: prefix } },
    })),
  };

  const [
    activeSubs,
    pending,
    pastDue,
    cancelled,
    cancelled30d,
    activeAt30dAgo,
    signups30d,
    signups60dPrior,
    sourceRows,
    planRows,
    alertVolume30d,
    operatorActions30dRows,
    totalUsers,
    totalCompanies,
    managedFleetCompanies,
    contactInquiries30d,
    referralsCreated30d,
    referralStatusRows,
    topReferrerRows,
  ] = await Promise.all([
    prisma.subscription.findMany({
      where: { status: 'ACTIVE', ...subUserWhere },
      select: {
        cadence: true,
        amountPaidCentavos: true,
        initialFeePaidCentavos: true,
        plan: { select: { name: true } },
      },
    }),
    prisma.subscription.count({
      where: { status: 'PENDING_PAYMENT', ...subUserWhere },
    }),
    prisma.subscription.count({
      where: { status: 'PAST_DUE', ...subUserWhere },
    }),
    prisma.subscription.count({
      where: { status: 'CANCELLED', ...subUserWhere },
    }),
    prisma.subscription.count({
      where: {
        status: 'CANCELLED',
        updatedAt: { gte: thirtyDaysAgo },
        ...subUserWhere,
      },
    }),
    prisma.subscription.count({
      where: {
        status: 'ACTIVE',
        OR: [
          { startDate: { lte: thirtyDaysAgo } },
          { startDate: null, createdAt: { lte: thirtyDaysAgo } },
        ],
        ...subUserWhere,
      },
    }),
    prisma.user.count({
      where: { createdAt: { gte: thirtyDaysAgo }, ...userWhere },
    }),
    prisma.user.count({
      where: {
        createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
        ...userWhere,
      },
    }),
    prisma.user.groupBy({
      by: ['signupSource'],
      where: userWhere,
      _count: { _all: true },
      orderBy: { _count: { signupSource: 'desc' } },
      take: 20,
    }),
    prisma.subscription.groupBy({
      by: ['planId'],
      where: { status: 'ACTIVE', ...subUserWhere },
      _count: { _all: true },
    }),
    prisma.eviewEvent.count({
      where: {
        timestamp: { gte: thirtyDaysAgo },
        eventType: { in: [...ALERT_EVENT_TYPES] },
        ...deviceExclusionWhere,
      },
    }),
    prisma.operatorAction.groupBy({
      by: ['kind'],
      where: { createdAt: { gte: thirtyDaysAgo } },
      _count: { _all: true },
    }),
    prisma.user.count({ where: userWhere }),
    prisma.company.count(),
    prisma.company.count({ where: { isManagedFleet: true } }),
    prisma.contactInquiry.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.referral.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.referral.groupBy({
      by: ['status'],
      _count: { _all: true },
      _sum: { creditCentavos: true },
    }),
    prisma.referral.groupBy({
      by: ['referrerUserId'],
      where: { status: 'REDEEMED' },
      _count: { _all: true },
      _sum: { creditCentavos: true },
      orderBy: { _count: { referrerUserId: 'desc' } },
      take: 10,
    }),
  ]);

  // MRR-equivalent: cadence-normalize ACTIVE subs to a monthly cost.
  // Total amountPaid is the cycle total; divide by cadence length.
  let mrrEquivalentCentavos = 0;
  for (const s of activeSubs) {
    const cycleCents = s.amountPaidCentavos ?? 0;
    const cycleInitial = s.initialFeePaidCentavos ?? 0;
    // The recurring portion is (amountPaid - initialFee). For ACTIVE
    // subs that already paid, this is the recurring chunk.
    const recurringCycle = Math.max(0, cycleCents - cycleInitial);
    const months =
      s.cadence === 'ANNUAL' ? 12 : s.cadence === 'SEMESTRAL' ? 6 : 1;
    mrrEquivalentCentavos += Math.round(recurringCycle / months);
  }

  const churnRate30d =
    activeAt30dAgo > 0 ? cancelled30d / activeAt30dAgo : 0;

  // planDistribution needs plan names — resolve in a single follow-up.
  const planIds = planRows.map((p) => p.planId);
  const planNameRows = planIds.length
    ? await prisma.plan.findMany({
        where: { id: { in: planIds } },
        select: { id: true, name: true },
      })
    : [];
  const planNameById = new Map(planNameRows.map((p) => [p.id, p.name]));

  // Referral status counts + accrued credit. groupBy returns one row
  // per status that actually appears, so we read off the array rather
  // than assume the three keys are present.
  let referralPending = 0;
  let referralRedeemed = 0;
  let referralExpired = 0;
  let referralCreditAccruedCentavos = 0;
  for (const row of referralStatusRows) {
    const n = row._count._all;
    if (row.status === 'PENDING') referralPending = n;
    if (row.status === 'REDEEMED') {
      referralRedeemed = n;
      referralCreditAccruedCentavos = row._sum.creditCentavos ?? 0;
    }
    if (row.status === 'EXPIRED') referralExpired = n;
  }
  const topReferrerIds = topReferrerRows.map((r) => r.referrerUserId);
  const topReferrerUsers = topReferrerIds.length
    ? await prisma.user.findMany({
        where: { id: { in: topReferrerIds } },
        select: { id: true, email: true, fullName: true },
      })
    : [];
  const topReferrerById = new Map(topReferrerUsers.map((u) => [u.id, u]));
  const topReferrers = topReferrerRows
    .map((r) => {
      const u = topReferrerById.get(r.referrerUserId);
      return {
        userId: r.referrerUserId,
        email: u?.email ?? '(unknown)',
        fullName: u?.fullName ?? null,
        redeemedCount: r._count._all,
        creditCentavos: r._sum.creditCentavos ?? 0,
      };
    })
    .sort((a, b) => b.redeemedCount - a.redeemedCount);

  return {
    generatedAt: new Date(now).toISOString(),
    mrrEquivalentCentavos,
    subscriptionCounts: {
      active: activeSubs.length,
      pendingPayment: pending,
      pastDue,
      cancelled,
    },
    signups30d,
    signups60dPrior,
    churnRate30d,
    channelAttribution: sourceRows
      .map((r) => ({
        source: r.signupSource ?? '(sin etiqueta)',
        count: r._count._all,
      }))
      .sort((a, b) => b.count - a.count),
    planDistribution: planRows
      .map((p) => ({
        planName: planNameById.get(p.planId) ?? p.planId,
        count: p._count._all,
      }))
      .sort((a, b) => b.count - a.count),
    alertVolume30d,
    operatorActivity30d: operatorActions30dRows
      .map((r) => ({ kind: r.kind, count: r._count._all }))
      .sort((a, b) => b.count - a.count),
    totalUsers,
    totalCompanies,
    managedFleetCompanies,
    contactInquiries30d,
    referrals: {
      created30d: referralsCreated30d,
      statusCounts: {
        pending: referralPending,
        redeemed: referralRedeemed,
        expired: referralExpired,
      },
      creditAccruedCentavos: referralCreditAccruedCentavos,
      topReferrers,
    },
  };
}
