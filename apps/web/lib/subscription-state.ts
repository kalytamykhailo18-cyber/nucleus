import { prisma } from '@/lib/db';

/**
 * Server-side helper for fetching a user's most recent subscription state.
 * Shared by the `AppHeader` (conditional "Termina tu pago" tab) and the
 * `PendingPaymentBanner` so both reach the same conclusion without
 * duplicating the query shape.
 */
export type SubscriptionStatusLive =
  | 'PENDING_PAYMENT'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELLED';

export interface LatestSubscriptionState {
  subscriptionId: string;
  status: SubscriptionStatusLive;
  planType: 'ANGELA_ESENCIAL' | 'ANGELA_TOTAL';
}

export async function getLatestSubscriptionState(
  userId: string,
): Promise<LatestSubscriptionState | null> {
  const sub = await prisma.subscription.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      plan: { select: { type: true } },
    },
  });
  if (!sub) return null;
  return {
    subscriptionId: sub.id,
    status: sub.status,
    planType: sub.plan.type,
  };
}
