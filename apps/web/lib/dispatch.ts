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
): Promise<Paginated<AwaitingShipmentRow>> {
  const where = {
    status: 'ACTIVE' as const,
    shippedAt: null,
    user: { questionnaireCompleted: true },
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
): Promise<Paginated<AwaitingActivationRow>> {
  const where = {
    status: 'ACTIVE' as const,
    shippedAt: { not: null },
    activatedAt: null,
  };
  const totalRows = await prisma.subscription.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const rows = await prisma.subscription.findMany({
    where,
    orderBy: { shippedAt: 'asc' },
    take: pageSize,
    skip: (safePage - 1) * pageSize,
    select: {
      id: true,
      shippedAt: true,
      plan: { select: { name: true } },
      user: {
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          shippingAddress: true,
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
