import { prisma } from '@/lib/db';

/**
 * Company / B2B membership helpers.
 *
 * The data model is intentionally minimal at this stage: a Company
 * groups CompanyMembership rows that link to User. Each row carries
 * either an ADMIN role (HR / Safety lead — sees the company-wide
 * dashboard) or a MEMBER role (worker wearing the device).
 *
 * Higher-level surfaces (admin CRUD, CSV onboarding, company-Master
 * dashboard) land in Steps 11–14 and stack on top of these helpers.
 */

export interface CompanySummary {
  id: string;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  notes: string | null;
  isActive: boolean;
  /** Industrial-fleet rail (Phase C #1 reshape, 2026-06-10). */
  isManagedFleet: boolean;
  createdAt: string;
  adminCount: number;
  memberCount: number;
}

export async function fetchCompanyById(id: string): Promise<CompanySummary | null> {
  const row = await prisma.company.findUnique({
    where: { id },
    include: {
      memberships: { select: { role: true } },
    },
  });
  if (!row) return null;
  return summarize(row);
}

/**
 * Juan 2026-06-23 review item B.3: when `strict` is true, hide every
 * spec/demo company — Playwright tests seed Companies named with
 * patterns like "Acme Spec Co", "E2E Pemex", "Demo Industrial",
 * "Test Manufacturing". Real Medtronic-style customers do not have
 * those tokens in their names. Strict is the default; `?vista=all`
 * opts back into the unfiltered view (Playwright session sets a
 * cookie so spec assertions keep firing against seeded rows).
 */
// 2026-06-29 follow-up (Juan): the managed-fleet spec churn from
// 2026-06-26 onward seeded "UI Industrial", "OpUI Industrial",
// "HR-Lead UI" rows whose names matched none of the existing tokens.
// Every spec-generated company carries a `${Date.now().toString(36)}`
// cuid-style suffix (always starts with " mq" in 2026), so adding
// the leading-space ' mq' token catches them all — past, present,
// and any future spec that forgets to include a literal blocked
// token in the name. Real Spanish/English customer names virtually
// never contain a " mq" sequence; acceptable false-positive risk.
const DEMO_COMPANY_NAME_TOKENS = [
  'acme',
  'demo',
  'e2e',
  'spec',
  'test',
  'fixture',
  ' mq',
];

export interface PaginatedCompanies {
  rows: CompanySummary[];
  totalRows: number;
  totalPages: number;
  page: number;
  pageSize: number;
}

/**
 * 2026-06-24 follow-up: server-side pagination. The unfiltered table
 * grew past 400 rows from spec seeds and made a single page render
 * push past 5 s on parallel Playwright load — every modal-save→row-
 * visible assertion was racing the slow refresh. Slicing in SQL keeps
 * the rendered list to `pageSize` regardless of total seed pollution.
 */
export async function fetchCompanies(
  options: { strict?: boolean; page?: number; pageSize?: number } = {},
): Promise<PaginatedCompanies> {
  const pageSize = options.pageSize ?? 25;
  const requestedPage = Math.max(1, options.page ?? 1);

  // Prisma's `name: { not: { contains, mode } }` shape rejects `mode`
  // inside the nested `not` clause (validator error at runtime). Wrap
  // each demo-token filter in a top-level `NOT` so the case-
  // insensitive flag lives next to `contains` where Prisma accepts it.
  const nameExclusions = options.strict
    ? DEMO_COMPANY_NAME_TOKENS.map((token) => ({
        NOT: { name: { contains: token, mode: 'insensitive' as const } },
      }))
    : [];
  const where = nameExclusions.length ? { AND: nameExclusions } : {};

  const totalRows = await prisma.company.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = Math.min(requestedPage, totalPages);
  const rows = await prisma.company.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { memberships: { select: { role: true } } },
    take: pageSize,
    skip: (safePage - 1) * pageSize,
  });

  return {
    rows: rows.map(summarize),
    totalRows,
    totalPages,
    page: safePage,
    pageSize,
  };
}

function summarize(row: {
  id: string;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  notes: string | null;
  isActive: boolean;
  isManagedFleet: boolean;
  createdAt: Date;
  memberships: Array<{ role: 'ADMIN' | 'MEMBER' }>;
}): CompanySummary {
  const adminCount = row.memberships.filter((m) => m.role === 'ADMIN').length;
  const memberCount = row.memberships.filter((m) => m.role === 'MEMBER').length;
  return {
    id: row.id,
    name: row.name,
    contactName: row.contactName,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    notes: row.notes,
    isActive: row.isActive,
    isManagedFleet: row.isManagedFleet,
    createdAt: row.createdAt.toISOString(),
    adminCount,
    memberCount,
  };
}

/**
 * Returns the Company a user is a MEMBER or ADMIN of, or null. A user
 * with multiple memberships (future multi-company admins) returns the
 * most recently created one; once we have a real multi-company case
 * the caller should switch to listing all memberships explicitly.
 */
export async function fetchCompanyForUser(
  userId: string,
): Promise<{ company: CompanySummary; role: 'ADMIN' | 'MEMBER' } | null> {
  const m = await prisma.companyMembership.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      company: {
        include: { memberships: { select: { role: true } } },
      },
    },
  });
  if (!m) return null;
  return {
    company: summarize(m.company),
    role: m.role as 'ADMIN' | 'MEMBER',
  };
}

/**
 * Member row for the Company-Master dashboard. One row per worker
 * (CompanyMembership role=MEMBER), enriched with the worker's
 * primary device IMEI + battery + last-seen, and the count of
 * unresolved alerts in the last 30 days so the admin sees who needs
 * attention without drilling in.
 */
export interface CompanyMemberRow {
  membershipId: string;
  userId: string;
  email: string;
  fullName: string | null;
  employeeId: string | null;
  jobTitle: string | null;
  primaryDeviceImei: string | null;
  primaryDeviceBattery: number | null;
  primaryDeviceLastSeenAt: string | null;
  /** Last known GPS fix for the primary device. null when the device
   *  has never reported lat/lng. Surfaced on the /company fleet map so
   *  the HR lead sees where every worker is at a glance (Medtronic ask
   *  2026-06-19). */
  primaryDeviceLat: number | null;
  primaryDeviceLng: number | null;
  recentAlertCount: number;
  /** Up to 5 most recent SOS / fall / battery rows in the last 30 days.
   *  Rendered inline under the member card so the HR lead sees what
   *  kind of alert fired without drilling in (Medtronic ask 2026-06-19). */
  recentAlerts: Array<{
    id: string;
    eventType: 'sos' | 'fall_detection' | 'battery_low';
    timestamp: string;
    lat: number | null;
    lng: number | null;
  }>;
}

/**
 * Returns the full Company-Master dashboard context for a given admin
 * user: their Company plus the list of all MEMBER rows with device +
 * alert metadata. Returns null when the user is not an ADMIN of any
 * Company (the caller bounces such users to /dashboard).
 */
export async function fetchCompanyAdminContext(
  userId: string,
): Promise<{ company: CompanySummary; members: CompanyMemberRow[] } | null> {
  const adminMembership = await prisma.companyMembership.findFirst({
    where: { userId, role: 'ADMIN' },
    orderBy: { createdAt: 'desc' },
    include: {
      company: {
        include: { memberships: { select: { role: true } } },
      },
    },
  });
  if (!adminMembership) return null;
  return fetchCompanyContextById(adminMembership.companyId);
}

/**
 * Same shape as fetchCompanyAdminContext but keyed by companyId — used
 * by the admin-side per-company detail page where the global ADMIN
 * inspects a Company they are NOT a member of (Juan reviewing Medtronic
 * or Pemex). Returns null only when the Company row doesn't exist.
 */
export async function fetchCompanyContextById(
  companyId: string,
): Promise<{ company: CompanySummary; members: CompanyMemberRow[] } | null> {
  const companyRow = await prisma.company.findUnique({
    where: { id: companyId },
    include: { memberships: { select: { role: true } } },
  });
  if (!companyRow) return null;

  const memberRows = await prisma.companyMembership.findMany({
    where: { companyId, role: 'MEMBER' },
    orderBy: { createdAt: 'asc' },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          fullName: true,
        },
      },
    },
  });

  // Last 30 days window for the unresolved-alert count. Aligns with the
  // /admin/operator board's "Recientes" cutoff so the company admin
  // sees the same urgency the call-center sees.
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const members: CompanyMemberRow[] = await Promise.all(
    memberRows.map(async (m) => {
      const userDevices = await prisma.userDevice.findMany({
        where: { userId: m.userId },
        orderBy: [{ isPrimary: 'desc' }, { assignedAt: 'asc' }],
        select: { eviewDeviceId: true },
        take: 1,
      });
      const primaryImei = userDevices[0]?.eviewDeviceId ?? null;

      let primaryBattery: number | null = null;
      let primaryLastSeen: string | null = null;
      let primaryLat: number | null = null;
      let primaryLng: number | null = null;
      let alertCount = 0;
      let recentAlerts: CompanyMemberRow['recentAlerts'] = [];
      if (primaryImei) {
        const [latestEvent, latestBatteryEvent, latestFix, alertCountQuery, recentAlertRows] = await Promise.all([
          prisma.eviewEvent.findFirst({
            where: { eviewDeviceId: primaryImei },
            orderBy: { timestamp: 'desc' },
            select: { timestamp: true },
          }),
          prisma.eviewEvent.findFirst({
            where: { eviewDeviceId: primaryImei, batteryLevel: { not: null } },
            orderBy: { timestamp: 'desc' },
            select: { batteryLevel: true },
          }),
          prisma.eviewEvent.findFirst({
            where: {
              eviewDeviceId: primaryImei,
              lat: { not: null },
              lng: { not: null },
            },
            orderBy: { timestamp: 'desc' },
            select: { lat: true, lng: true },
          }),
          prisma.eviewEvent.count({
            where: {
              eviewDeviceId: primaryImei,
              timestamp: { gte: since },
              // Juan 2026-06-23 (D.1b): company view shows ONLY
              // emergency alerts (SOS + fall). Battery state still
              // appears on the worker card as a percentage; the
              // recent-alerts list narrows to events the HR lead
              // actually needs to act on.
              eventType: { in: ['sos', 'fall_detection'] },
            },
          }),
          prisma.eviewEvent.findMany({
            where: {
              eviewDeviceId: primaryImei,
              timestamp: { gte: since },
              // Juan 2026-06-23 (D.1b): company view shows ONLY
              // emergency alerts (SOS + fall). Battery state still
              // appears on the worker card as a percentage; the
              // recent-alerts list narrows to events the HR lead
              // actually needs to act on.
              eventType: { in: ['sos', 'fall_detection'] },
            },
            orderBy: { timestamp: 'desc' },
            take: 5,
            select: {
              id: true,
              eventType: true,
              timestamp: true,
              lat: true,
              lng: true,
            },
          }),
        ]);
        primaryBattery = latestBatteryEvent?.batteryLevel ?? null;
        primaryLastSeen = latestEvent?.timestamp.toISOString() ?? null;
        primaryLat = latestFix?.lat ?? null;
        primaryLng = latestFix?.lng ?? null;
        alertCount = alertCountQuery;
        recentAlerts = recentAlertRows.map((r) => ({
          id: r.id,
          eventType: r.eventType as 'sos' | 'fall_detection' | 'battery_low',
          timestamp: r.timestamp.toISOString(),
          lat: r.lat,
          lng: r.lng,
        }));
      }

      return {
        membershipId: m.id,
        userId: m.userId,
        email: m.user.email,
        fullName: m.user.fullName,
        employeeId: m.employeeId,
        jobTitle: m.jobTitle,
        primaryDeviceImei: primaryImei,
        primaryDeviceBattery: primaryBattery,
        primaryDeviceLastSeenAt: primaryLastSeen,
        primaryDeviceLat: primaryLat,
        primaryDeviceLng: primaryLng,
        recentAlertCount: alertCount,
        recentAlerts,
      };
    }),
  );

  return {
    company: summarize(companyRow),
    members,
  };
}
