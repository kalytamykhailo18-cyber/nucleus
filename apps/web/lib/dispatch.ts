import { prisma } from '@/lib/db';

/**
 * Call-center dispatch board queries — Juan 2026-05-19.
 *
 * Two buckets:
 *   1. Awaiting shipment: ACTIVE subscriptions whose buyer completed
 *      the questionnaire and we haven't stamped `shippedAt` on yet.
 *   2. Awaiting activation: subscriptions we've already shipped but
 *      haven't paired with a pendant IMEI yet (`activatedAt` is null).
 */

export interface AwaitingShipmentRow {
  subscriptionId: string;
  userId: string;
  email: string;
  fullName: string | null;
  buyerPhone: string | null;
  shippingAddress: string | null;
  homeAddress: string | null;
  purchaseDate: string | null;
  planName: string;
}

export interface AwaitingActivationRow {
  subscriptionId: string;
  userId: string;
  email: string;
  fullName: string | null;
  buyerPhone: string | null;
  shippedAt: string;
  shippingAddress: string | null;
  planName: string;
}

export interface Paginated<T> {
  rows: T[];
  totalRows: number;
  totalPages: number;
  page: number;
  pageSize: number;
}

export async function fetchAwaitingShipment(
  page = 1,
  pageSize = 50,
  options: { callcenterMode?: boolean } = {},
): Promise<Paginated<AwaitingShipmentRow>> {
  const { userFilterFor } = await import('@/lib/admin-exclusions');
  const userFilter = userFilterFor(options.callcenterMode ?? false);
  // Juan 2026-06-23: dropped the `questionnaireCompleted: true` gate so
  // buyers who pay but skip the questionnaire (e.g. Anzonyt Ortega)
  // surface to the dispatcher. The shipping modal handles a missing
  // address gracefully; the dispatcher follows up by phone if a row
  // lacks one. Strict-default user filter already hides every
  // @nucleus-test.local + @managed seed for Juan's view (no cookie),
  // so the flood the gate-removal could have caused never reaches him;
  // Playwright sessions explicitly opt into lenient to keep seeds
  // visible.
  const where = {
    status: 'ACTIVE' as const,
    shippedAt: null,
    user: userFilter,
  };
  const totalRows = await prisma.subscription.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const rows = await prisma.subscription.findMany({
    where,
    orderBy: { purchaseDate: 'asc' },
    take: pageSize,
    skip: (safePage - 1) * pageSize,
    select: {
      id: true,
      purchaseDate: true,
      plan: { select: { name: true } },
      user: {
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          shippingAddress: true,
          address: true,
        },
      },
    },
  });
  return {
    rows: rows.map((r) => ({
      subscriptionId: r.id,
      userId: r.user.id,
      email: r.user.email,
      fullName: r.user.fullName,
      buyerPhone: r.user.phone,
      shippingAddress: r.user.shippingAddress,
      homeAddress: r.user.address,
      purchaseDate: r.purchaseDate?.toISOString() ?? null,
      planName: r.plan.name,
    })),
    totalRows,
    totalPages,
    page: safePage,
    pageSize,
  };
}

export async function fetchAwaitingActivation(
  page = 1,
  pageSize = 50,
  options: { callcenterMode?: boolean } = {},
): Promise<Paginated<AwaitingActivationRow>> {
  const { userFilterFor } = await import('@/lib/admin-exclusions');
  const userFilter = userFilterFor(options.callcenterMode ?? false);

  // Two categories of "awaiting activation":
  //   1. Never activated — `activatedAt IS NULL` (the classic case).
  //   2. Previously activated to a device that has since been unpaired
  //      from the user. This happens on device replacement: admin
  //      unpairs the old IMEI's UserDevice row, and the sub needs to
  //      re-appear in the queue so the admin can pair the replacement.
  //
  // Prisma cannot express category #2 directly (it would need to
  // reference `Subscription.activatedDeviceId` inside a UserDevice
  // relation filter, which the query builder does not support). Solved
  // by fetching the superset (status ACTIVE + shipped) and filtering
  // in-process. The set is bounded — historical operator throughput
  // caps activated subs at low-hundreds — so pagination-after-filter
  // is honest.
  const superset = await prisma.subscription.findMany({
    where: {
      status: 'ACTIVE',
      shippedAt: { not: null },
      user: userFilter,
    },
    orderBy: { shippedAt: 'asc' },
    select: {
      id: true,
      shippedAt: true,
      activatedAt: true,
      activatedDeviceId: true,
      plan: { select: { name: true } },
      user: {
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          shippingAddress: true,
          devices: {
            where: { role: 'MASTER' },
            select: { eviewDeviceId: true },
          },
        },
      },
    },
  });

  const pending = superset.filter((sub) => {
    if (sub.activatedAt === null) return true;
    if (sub.activatedDeviceId === null) return true; // defensive
    const masterIds = new Set(
      sub.user.devices.map((d) => d.eviewDeviceId),
    );
    return !masterIds.has(sub.activatedDeviceId);
  });

  const totalRows = pending.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const slice = pending.slice(start, start + pageSize);

  return {
    rows: slice.map((r) => ({
      subscriptionId: r.id,
      userId: r.user.id,
      email: r.user.email,
      fullName: r.user.fullName,
      buyerPhone: r.user.phone,
      shippedAt: r.shippedAt!.toISOString(),
      shippingAddress: r.user.shippingAddress,
      planName: r.plan.name,
    })),
    totalRows,
    totalPages,
    page: safePage,
    pageSize,
  };
}

/**
 * Resolve which page a given subscription sits on for whichever queue
 * it belongs to. Used by `/admin/dispatch?focus=<subId>` so the cross-
 * link from `/admin/registrations` lands on the page that actually
 * renders the focused row — instead of always loading page 1 and
 * hoping the row is there (it isn't, once the queue paginates).
 *
 * Returns `{ queue: null }` when the subscription isn't pending in
 * either queue (already activated or unknown).
 */
export async function resolveDispatchFocusPage(
  subscriptionId: string,
  pageSize: number,
  options: { callcenterMode?: boolean } = {},
): Promise<
  | { queue: 'shipping' | 'activation'; page: number }
  | { queue: null }
> {
  const { userFilterFor } = await import('@/lib/admin-exclusions');
  const userFilter = userFilterFor(options.callcenterMode ?? false);

  const target = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: {
      id: true,
      userId: true,
      status: true,
      shippedAt: true,
      activatedAt: true,
      activatedDeviceId: true,
      purchaseDate: true,
    },
  });
  if (!target || target.status !== 'ACTIVE') return { queue: null };

  if (target.shippedAt === null) {
    // Shipping queue: ordered purchaseDate ASC. Count rows that come
    // BEFORE this one to compute the 1-indexed page.
    const ahead = await prisma.subscription.count({
      where: {
        status: 'ACTIVE',
        shippedAt: null,
        user: userFilter,
        OR: [
          { purchaseDate: { lt: target.purchaseDate ?? undefined } },
          {
            purchaseDate: target.purchaseDate ?? undefined,
            id: { lt: target.id },
          },
        ],
      },
    });
    return { queue: 'shipping', page: Math.floor(ahead / pageSize) + 1 };
  }

  // Activation queue: eligible when never activated, OR previously
  // activated to a device that has since been unpaired from the user
  // (device-replacement recovery — see fetchAwaitingActivation for the
  // full logic). If eligible, count how many other eligible rows sort
  // ahead of this one on `shippedAt ASC` and derive the page.
  const eligibleForActivationQueue = await isAwaitingActivation({
    activatedAt: target.activatedAt,
    activatedDeviceId: target.activatedDeviceId,
    userId: target.userId,
  });
  if (eligibleForActivationQueue) {
    // Count is done by paging through the same superset the queue uses
    // so the counting logic stays in one place. Cheap since the queue
    // fits in memory as documented in fetchAwaitingActivation.
    const { rows } = await fetchAwaitingActivation(1, 10_000, {
      callcenterMode: options.callcenterMode,
    });
    const idx = rows.findIndex((r) => r.subscriptionId === target.id);
    if (idx >= 0) {
      return { queue: 'activation', page: Math.floor(idx / pageSize) + 1 };
    }
  }
  return { queue: null };
}

/**
 * Is this subscription currently pending activation? Two cases: never
 * activated, or previously activated to a device that has since been
 * unpaired from the user.
 */
async function isAwaitingActivation(sub: {
  activatedAt: Date | null;
  activatedDeviceId: string | null;
  userId: string;
}): Promise<boolean> {
  if (sub.activatedAt === null) return true;
  if (sub.activatedDeviceId === null) return true; // defensive
  const pairing = await prisma.userDevice.findFirst({
    where: {
      userId: sub.userId,
      eviewDeviceId: sub.activatedDeviceId,
      role: 'MASTER',
    },
    select: { id: true },
  });
  return pairing === null;
}
