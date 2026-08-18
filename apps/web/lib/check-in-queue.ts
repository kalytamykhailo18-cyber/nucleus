import { prisma } from '@/lib/db';

/**
 * Check-in dispatcher queue (Juan 2026-05-22 ask, shipped 2026-06-16).
 *
 * Juan wanted the call-center to see, in one place, every senior who
 * has the weekly Sensu check-in turned on. So when Monday morning
 * rolls around, the operator knows which numbers to dial without
 * trawling the customer roster.
 *
 * Surface is `/admin/check-ins`. Data is User-row driven: any account
 * with `checkInEnabled=true` shows up. Today (Mon/Tue/etc.) bubbles to
 * the top so the dispatcher's "do now" list is the first thing they
 * see; the rest of the week falls under that. Time-of-day chips let
 * morning-shift and evening-shift operators filter their own slot.
 */

export type CheckInDay =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY';
export type CheckInTimeOfDay = 'MORNING' | 'AFTERNOON' | 'EVENING';

export interface CheckInQueueRow {
  userId: string;
  fullName: string | null;
  userPhone: string | null;
  email: string;
  day: CheckInDay;
  timeOfDay: CheckInTimeOfDay | null;
  /** Primary device IMEI, null if unpaired — operator still calls. */
  primaryDeviceImei: string | null;
  /** Account owner's phone, useful when the senior's userPhone is empty. */
  ownerPhone: string | null;
  city: string | null;
  medicalConditions: string | null;
  bloodType: string | null;
}

const DAY_ORDER: CheckInDay[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
];

const ENG_DAY_BY_INDEX: Record<number, CheckInDay | null> = {
  0: null, // Sunday — no check-ins
  1: 'MONDAY',
  2: 'TUESDAY',
  3: 'WEDNESDAY',
  4: 'THURSDAY',
  5: 'FRIDAY',
  6: null, // Saturday — no check-ins
};

export function todayCheckInDay(): CheckInDay | null {
  // America/Mexico_City is what the call-center operates in; the JS
  // Date is server-side UTC, so we shift by the Mexico City offset
  // before reading the day. Mexico City is UTC-6 (no DST since 2022).
  const nowUtc = new Date();
  const mexicoCityMs = nowUtc.getTime() - 6 * 60 * 60 * 1000;
  return ENG_DAY_BY_INDEX[new Date(mexicoCityMs).getUTCDay()] ?? null;
}

export async function fetchCheckInQueue(
  options: { callcenterMode?: boolean } = {},
): Promise<CheckInQueueRow[]> {
  // Strip the seeded demo + Playwright fixture rows when the viewer is
  // a call-center / production admin (Juan 2026-06-17). The lenient
  // path (callcenterMode=false → demo@sensu.com.mx admin) keeps demos
  // visible so the Playwright suite continues to assert on them.
  const { userFilterFor } = await import('@/lib/admin-exclusions');
  const userFilter = userFilterFor(options.callcenterMode ?? false);
  const rows = await prisma.user.findMany({
    where: { checkInEnabled: true, ...userFilter },
    select: {
      id: true,
      email: true,
      fullName: true,
      phone: true,
      userPhone: true,
      checkInDay: true,
      checkInTimeOfDay: true,
      address: true,
      medicalConditions: true,
      bloodType: true,
      devices: {
        orderBy: [{ isPrimary: 'desc' }, { assignedAt: 'asc' }],
        take: 1,
        select: { eviewDeviceId: true },
      },
    },
  });

  return rows
    .filter((r) => r.checkInDay !== null)
    .map((r) => ({
      userId: r.id,
      fullName: r.fullName,
      userPhone: r.userPhone,
      email: r.email,
      day: r.checkInDay as CheckInDay,
      timeOfDay: (r.checkInTimeOfDay as CheckInTimeOfDay | null) ?? null,
      primaryDeviceImei: r.devices[0]?.eviewDeviceId ?? null,
      ownerPhone: r.phone,
      city: extractCity(r.address),
      medicalConditions: r.medicalConditions,
      bloodType: r.bloodType,
    }))
    .sort(byTodayFirstThenDayThenTime);
}

function byTodayFirstThenDayThenTime(
  a: CheckInQueueRow,
  b: CheckInQueueRow,
): number {
  const today = todayCheckInDay();
  const aToday = a.day === today ? 0 : 1;
  const bToday = b.day === today ? 0 : 1;
  if (aToday !== bToday) return aToday - bToday;
  const dayA = DAY_ORDER.indexOf(a.day);
  const dayB = DAY_ORDER.indexOf(b.day);
  if (dayA !== dayB) return dayA - dayB;
  const slotOrder: Record<string, number> = {
    MORNING: 0,
    AFTERNOON: 1,
    EVENING: 2,
  };
  const slotA = a.timeOfDay ? slotOrder[a.timeOfDay] ?? 99 : 99;
  const slotB = b.timeOfDay ? slotOrder[b.timeOfDay] ?? 99 : 99;
  if (slotA !== slotB) return slotA - slotB;
  return (a.fullName ?? a.email).localeCompare(b.fullName ?? b.email, 'es-MX');
}

/**
 * Pull the city out of an address string. Best-effort — addresses are
 * free-text, so we look for ", <City>," or "<City>, <State>" at the
 * end of the string. Returns null if nothing usable is found.
 */
function extractCity(address: string | null): string | null {
  if (!address) return null;
  const trimmed = address.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return parts[parts.length - 2] ?? null;
  }
  return null;
}
