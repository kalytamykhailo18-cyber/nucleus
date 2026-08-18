import { prisma } from '@/lib/db';
import { buildAuraIdentifier } from '@/lib/aura-identifier';

/**
 * Caller-ID enrichment for the call-center dispatch desk.
 *
 * Two inbound shapes:
 *  - Device-side SOS: the Eview pendant dials +52 55 92 81 52 86. The
 *    PBX hands us the deviceId; we return the family roster for that
 *    device.
 *  - App-side SOS: the senior taps the in-app SOS button on their own
 *    phone, which dials +52 8000570180. The PBX hands us the caller's
 *    number; we match by Care Recipient phone or Master phone and
 *    return the roster of every device they own.
 *
 * Both shapes return the same payload so the dispatch system has one
 * code path. Never throws on missing data — empty roster is a valid
 * response (means we don't know who's calling).
 */

export interface RosterContact {
  fullName: string | null;
  phone: string | null;
  email: string | null;
  relationship?: string | null;
}

export interface CareRecipientView {
  fullName: string | null;
  phone: string | null;
  age: number | null;
  address: string | null;
  shippingAddress: string | null;
  medicalConditions: string | null;
  insuranceInfo: string | null;
  livesAlone: boolean | null;
  curp: string | null;
  /** RFC-shaped identifier passed to Aura for assistance dispatch
   *  (CURP[0:10] + homoclave || 'XXX'). Null when CURP isn't on file. */
  auraIdentifier: string | null;
  checkInEnabled: boolean | null;
  checkInDay: string | null;
  checkInTimeOfDay: string | null;
}

/**
 * Industrial-fleet context for the operator-board modal. Present
 * only when the matched device's MASTER is a MANAGED_WORKER routed
 * to a Company with isManagedFleet=true. The presence of this field
 * tells the dispatcher: do NOT call this worker's "family" — the
 * emergencyContacts array contains the company's shared roster, not
 * personal contacts.
 */
export interface ManagedFleetContext {
  companyName: string;
  workerFullName: string | null;
  employeeId: string | null;
  jobTitle: string | null;
}

export interface CallCenterLookup {
  matchedBy: 'deviceId' | 'phone';
  devices: Array<{
    deviceId: string;
    deviceName: string | null;
    phoneNumber: string | null;
  }>;
  accountOwner: {
    userId: string;
    email: string;
    clientId: string | null;
    phone: string | null;
  } | null;
  careRecipient: CareRecipientView | null;
  watchers: RosterContact[];
  emergencyContacts: RosterContact[];
  managedFleet: ManagedFleetContext | null;
}

function normalizePhone(raw: string): string {
  return raw.replace(/[^\d+]/g, '');
}

async function buildLookupForMaster(
  masterUserId: string,
  matchedBy: 'deviceId' | 'phone',
): Promise<CallCenterLookup> {
  const master = await prisma.user.findUnique({
    where: { id: masterUserId },
    select: {
      id: true,
      email: true,
      clientId: true,
      fullName: true,
      phone: true,
      userPhone: true,
      age: true,
      address: true,
      shippingAddress: true,
      medicalConditions: true,
      insuranceInfo: true,
      livesAlone: true,
      curp: true,
      rfcHomoclave: true,
      kind: true,
      checkInEnabled: true,
      checkInDay: true,
      checkInTimeOfDay: true,
      emergencyContacts: {
        orderBy: { priority: 'asc' },
        select: { fullName: true, phone: true, relationship: true },
      },
      // Industrial-fleet reshape (Phase C #1, Juan 2026-06-10). For
      // MANAGED_WORKER masters we substitute their (always empty)
      // personal roster with the shared CompanyEmergencyContact list
      // resolved via their CompanyMembership. One round-trip — the
      // company id is the worker's only membership.
      companyMemberships: {
        orderBy: { createdAt: 'asc' },
        take: 1,
        select: {
          employeeId: true,
          jobTitle: true,
          company: {
            select: {
              name: true,
              isManagedFleet: true,
              emergencyContacts: {
                orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
                select: {
                  fullName: true,
                  phone: true,
                  relationship: true,
                },
              },
            },
          },
        },
      },
      devices: {
        where: { role: 'MASTER' },
        select: {
          eviewDeviceId: true,
          device: { select: { deviceName: true, phoneNumber: true } },
        },
      },
    },
  });
  if (!master) {
    return {
      matchedBy,
      devices: [],
      accountOwner: null,
      careRecipient: null,
      watchers: [],
      emergencyContacts: [],
      managedFleet: null,
    };
  }

  const deviceIds = master.devices.map((d) => d.eviewDeviceId);
  const watcherRows = deviceIds.length
    ? await prisma.userDevice.findMany({
        where: { role: 'WATCHER', eviewDeviceId: { in: deviceIds } },
        select: {
          user: { select: { fullName: true, email: true, phone: true } },
        },
      })
    : [];

  return {
    matchedBy,
    devices: master.devices.map((d) => ({
      deviceId: d.eviewDeviceId,
      deviceName: d.device.deviceName ?? null,
      phoneNumber: d.device.phoneNumber ?? null,
    })),
    accountOwner: {
      userId: master.id,
      email: master.email,
      clientId: master.clientId,
      phone: master.phone,
    },
    careRecipient: {
      fullName: master.fullName,
      // userPhone is the senior's own line (from the questionnaire);
      // master.phone is the buyer/family member's line. The call-center
      // wants the senior's number first because that is the inbound
      // caller on the app-side SOS path.
      phone: master.userPhone,
      age: master.age,
      address: master.address,
      shippingAddress: master.shippingAddress,
      medicalConditions: master.medicalConditions,
      insuranceInfo: master.insuranceInfo,
      livesAlone: master.livesAlone,
      curp: master.curp,
      auraIdentifier: buildAuraIdentifier(master.curp, master.rfcHomoclave),
      checkInEnabled: master.checkInEnabled,
      checkInDay: master.checkInDay,
      checkInTimeOfDay: master.checkInTimeOfDay,
    },
    watchers: watcherRows.map((w) => ({
      fullName: w.user.fullName,
      phone: w.user.phone,
      email: w.user.email,
    })),
    emergencyContacts: resolveEmergencyContacts(master),
    managedFleet: resolveManagedFleetContext(master),
  };
}

function resolveManagedFleetContext(master: {
  kind: string;
  fullName: string | null;
  companyMemberships: Array<{
    employeeId: string | null;
    jobTitle: string | null;
    company: {
      name: string;
      isManagedFleet: boolean;
    };
  }>;
}): ManagedFleetContext | null {
  if (master.kind !== 'MANAGED_WORKER') return null;
  const membership = master.companyMemberships[0];
  if (!membership || !membership.company.isManagedFleet) return null;
  return {
    companyName: membership.company.name,
    workerFullName: master.fullName,
    employeeId: membership.employeeId,
    jobTitle: membership.jobTitle,
  };
}

function resolveEmergencyContacts(master: {
  kind: string;
  emergencyContacts: Array<{
    fullName: string;
    phone: string;
    relationship: string | null;
  }>;
  companyMemberships: Array<{
    company: {
      isManagedFleet: boolean;
      emergencyContacts: Array<{
        fullName: string;
        phone: string;
        relationship: string | null;
      }>;
    };
  }>;
}): RosterContact[] {
  // Industrial-fleet rail: a MANAGED_WORKER carries no personal
  // contacts; the dispatcher dials the shared company roster instead.
  // Falls back to whatever personal contacts the User does happen to
  // have (zero) if the company has no shared roster configured yet —
  // honest empty state beats a partial substitution.
  if (master.kind === 'MANAGED_WORKER') {
    const company = master.companyMemberships[0]?.company;
    if (company?.isManagedFleet && company.emergencyContacts.length > 0) {
      return company.emergencyContacts.map((c) => ({
        fullName: c.fullName,
        phone: c.phone,
        relationship: c.relationship,
        email: null,
      }));
    }
  }
  return master.emergencyContacts.map((c) => ({
    fullName: c.fullName,
    phone: c.phone,
    relationship: c.relationship,
    email: null,
  }));
}

export async function lookupByDeviceId(
  deviceId: string,
): Promise<CallCenterLookup | null> {
  const master = await prisma.userDevice.findFirst({
    where: { eviewDeviceId: deviceId, role: 'MASTER' },
    orderBy: { isPrimary: 'desc' },
    select: { userId: true },
  });
  if (!master) return null;
  return buildLookupForMaster(master.userId, 'deviceId');
}

export async function lookupByPhone(
  rawPhone: string,
): Promise<CallCenterLookup | null> {
  const phone = normalizePhone(rawPhone);
  if (!phone) return null;

  // Match against either the senior's phone (User.userPhone — the
  // questionnaire's "Teléfono del usuario" field, the primary
  // app-side-SOS source) or the buyer's phone (User.phone). We do a
  // suffix match because numbers land with different country-code
  // prefixes or spacing depending on the carrier.
  const candidates = await prisma.user.findMany({
    where: {
      OR: [{ phone: { not: null } }, { userPhone: { not: null } }],
    },
    select: { id: true, phone: true, userPhone: true },
  });
  const phoneMatches = (raw: string | null): boolean => {
    if (!raw) return false;
    const normalized = normalizePhone(raw);
    if (!normalized) return false;
    return normalized.endsWith(phone) || phone.endsWith(normalized);
  };
  const match = candidates.find(
    (c) => phoneMatches(c.userPhone) || phoneMatches(c.phone),
  );
  if (!match) return null;

  // The matched user might be a Master or a Watcher. If they're a
  // Watcher, redirect the lookup to the Master who owns the same device
  // — the dispatcher needs the Care Recipient context, not the
  // relative's.
  const masterDevice = await prisma.userDevice.findFirst({
    where: { userId: match.id, role: 'MASTER' },
    select: { userId: true },
  });
  if (masterDevice) return buildLookupForMaster(masterDevice.userId, 'phone');

  const watcherDevice = await prisma.userDevice.findFirst({
    where: { userId: match.id, role: 'WATCHER' },
    select: { eviewDeviceId: true },
  });
  if (!watcherDevice) {
    return buildLookupForMaster(match.id, 'phone');
  }
  const masterOnDevice = await prisma.userDevice.findFirst({
    where: { eviewDeviceId: watcherDevice.eviewDeviceId, role: 'MASTER' },
    select: { userId: true },
  });
  if (!masterOnDevice) return null;
  return buildLookupForMaster(masterOnDevice.userId, 'phone');
}
