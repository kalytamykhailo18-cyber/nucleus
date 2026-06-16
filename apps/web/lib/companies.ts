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

export async function fetchCompanies(): Promise<CompanySummary[]> {
  const rows = await prisma.company.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      memberships: { select: { role: true } },
    },
  });
  return rows.map(summarize);
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
  recentAlertCount: number;
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
      let alertCount = 0;
      if (primaryImei) {
        const [latestEvent, latestBatteryEvent, recentAlerts] = await Promise.all([
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
          prisma.eviewEvent.count({
            where: {
              eviewDeviceId: primaryImei,
              timestamp: { gte: since },
              eventType: { in: ['sos', 'fall_detection', 'battery_low'] },
            },
          }),
        ]);
        primaryBattery = latestBatteryEvent?.batteryLevel ?? null;
        primaryLastSeen = latestEvent?.timestamp.toISOString() ?? null;
        alertCount = recentAlerts;
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
        recentAlertCount: alertCount,
      };
    }),
  );

  return {
    company: summarize(companyRow),
    members,
  };
}
