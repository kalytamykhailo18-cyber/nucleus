import { prisma } from '@/lib/db';
import { NON_FIXTURE_USER_FILTER } from '@/lib/admin-exclusions';

/**
 * Customer-funnel operational health (Juan 2026-06-30 large-progress
 * deliverable). Three cohorts that consistently leak revenue + give
 * customers a degraded experience:
 *
 *   1. Cuestionario pendiente — paid customers who never finished
 *      onboarding. Day-N drip catches the patient ones; this list is
 *      the human-intervention queue for the rest. Each row carries a
 *      Reenviar button (see admin/registrations/resend-welcome-button).
 *
 *   2. Sin dispositivo asignado — ACTIVE subscriptions with zero
 *      UserDevice rows. The "they paid but we never shipped" segment.
 *      Each row deep-links to /admin/dispatch focused on that
 *      subscription.
 *
 *   3. Dispositivo silencioso — paired devices whose last EviewEvent
 *      is >48h old. The "device went dark" segment.
 *
 * All queries honor NON_FIXTURE_USER_FILTER so test/spec rows stay
 * out of the view. Pagination is hard-capped at 50 per section — if a
 * cohort blows past that, the COUNT in the KPI tile flags the
 * overflow so Juan knows there's more to chase.
 */

export interface PendingQuestionnaireRow {
  subscriptionId: string;
  userId: string;
  email: string;
  fullName: string | null;
  daysWaiting: number;
  createdAt: string;
}

export interface NoDeviceRow {
  subscriptionId: string;
  userId: string;
  email: string;
  fullName: string | null;
  daysSinceActive: number;
  amountPaidCentavos: number;
  createdAt: string;
}

export interface SilentDeviceRow {
  deviceId: string;
  label: string | null;
  ownerEmail: string | null;
  ownerFullName: string | null;
  hoursSinceLastPing: number;
  lastPingAt: string | null;
}

export interface FunnelHealth {
  pendingQuestionnaire: PendingQuestionnaireRow[];
  pendingQuestionnaireTotal: number;
  noDevice: NoDeviceRow[];
  noDeviceTotal: number;
  silentDevices: SilentDeviceRow[];
  silentDevicesTotal: number;
}

// 20 rows per section per page (Ustym 2026-08-26); 3 sections at 50
// each rendered a 10+ screen page and silently truncated at 51+ rows.
// Callers pass per-section page numbers via `pages` so the page can
// navigate each section independently.
export const FUNNEL_SECTION_PAGE_SIZE = 20;
const SILENT_THRESHOLD_MS = 48 * 60 * 60 * 1_000;
const PENDING_THRESHOLD_MS = 24 * 60 * 60 * 1_000;

export interface FunnelPageInput {
  pendingPage?: number;
  noDevicePage?: number;
  silentPage?: number;
}

function skipFor(page: number | undefined): number {
  const p = Math.max(1, page ?? 1);
  return (p - 1) * FUNNEL_SECTION_PAGE_SIZE;
}

export async function fetchFunnelHealth(
  pages: FunnelPageInput = {},
): Promise<FunnelHealth> {
  const now = Date.now();
  const pendingCutoff = new Date(now - PENDING_THRESHOLD_MS);
  const silentCutoff = new Date(now - SILENT_THRESHOLD_MS);

  const [pendingRows, pendingTotal, noDeviceRows, noDeviceTotal, silentRows, silentTotal] =
    await Promise.all([
      prisma.subscription.findMany({
        where: {
          status: 'ACTIVE',
          createdAt: { lt: pendingCutoff },
          user: {
            is: {
              ...NON_FIXTURE_USER_FILTER,
              questionnaireCompleted: false,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
        take: FUNNEL_SECTION_PAGE_SIZE,
        skip: skipFor(pages.pendingPage),
        select: {
          id: true,
          createdAt: true,
          user: { select: { id: true, email: true, fullName: true } },
        },
      }),
      prisma.subscription.count({
        where: {
          status: 'ACTIVE',
          createdAt: { lt: pendingCutoff },
          user: {
            is: {
              ...NON_FIXTURE_USER_FILTER,
              questionnaireCompleted: false,
            },
          },
        },
      }),
      prisma.subscription.findMany({
        where: {
          status: 'ACTIVE',
          user: {
            is: {
              ...NON_FIXTURE_USER_FILTER,
              devices: { none: {} },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
        take: FUNNEL_SECTION_PAGE_SIZE,
        skip: skipFor(pages.noDevicePage),
        select: {
          id: true,
          createdAt: true,
          amountPaidCentavos: true,
          user: { select: { id: true, email: true, fullName: true } },
        },
      }),
      prisma.subscription.count({
        where: {
          status: 'ACTIVE',
          user: {
            is: {
              ...NON_FIXTURE_USER_FILTER,
              devices: { none: {} },
            },
          },
        },
      }),
      prisma.device.findMany({
        where: {
          isActive: true,
          userDevices: {
            some: {
              role: 'MASTER',
              user: { is: NON_FIXTURE_USER_FILTER },
            },
          },
          OR: [
            { eviewEvents: { none: {} } },
            { eviewEvents: { every: { timestamp: { lt: silentCutoff } } } },
          ],
        },
        orderBy: { createdAt: 'asc' },
        take: FUNNEL_SECTION_PAGE_SIZE,
        skip: skipFor(pages.silentPage),
        select: {
          deviceId: true,
          deviceName: true,
          userDevices: {
            where: { role: 'MASTER' },
            take: 1,
            select: {
              user: { select: { email: true, fullName: true } },
            },
          },
          eviewEvents: {
            orderBy: { timestamp: 'desc' },
            take: 1,
            select: { timestamp: true },
          },
        },
      }),
      prisma.device.count({
        where: {
          isActive: true,
          userDevices: {
            some: {
              role: 'MASTER',
              user: { is: NON_FIXTURE_USER_FILTER },
            },
          },
          OR: [
            { eviewEvents: { none: {} } },
            { eviewEvents: { every: { timestamp: { lt: silentCutoff } } } },
          ],
        },
      }),
    ]);

  return {
    pendingQuestionnaire: pendingRows.map((s) => ({
      subscriptionId: s.id,
      userId: s.user.id,
      email: s.user.email,
      fullName: s.user.fullName,
      daysWaiting: Math.floor((now - s.createdAt.getTime()) / 86_400_000),
      createdAt: s.createdAt.toISOString(),
    })),
    pendingQuestionnaireTotal: pendingTotal,
    noDevice: noDeviceRows.map((s) => ({
      subscriptionId: s.id,
      userId: s.user.id,
      email: s.user.email,
      fullName: s.user.fullName,
      daysSinceActive: Math.floor((now - s.createdAt.getTime()) / 86_400_000),
      amountPaidCentavos: s.amountPaidCentavos ?? 0,
      createdAt: s.createdAt.toISOString(),
    })),
    noDeviceTotal,
    silentDevices: silentRows.map((d) => {
      const latest = d.eviewEvents[0]?.timestamp ?? null;
      return {
        deviceId: d.deviceId,
        label: d.deviceName ?? null,
        ownerEmail: d.userDevices[0]?.user.email ?? null,
        ownerFullName: d.userDevices[0]?.user.fullName ?? null,
        hoursSinceLastPing: latest
          ? Math.floor((now - latest.getTime()) / 3_600_000)
          : Number.MAX_SAFE_INTEGER,
        lastPingAt: latest?.toISOString() ?? null,
      };
    }),
    silentDevicesTotal: silentTotal,
  };
}
