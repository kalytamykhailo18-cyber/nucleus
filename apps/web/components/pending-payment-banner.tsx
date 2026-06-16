import Link from 'next/link';
import { LuArrowRight, LuTriangleAlert } from 'react-icons/lu';
import { auth } from '@/auth';
import { getLatestSubscriptionState } from '@/lib/subscription-state';

/**
 * Global pending-payment banner.
 *
 * Renders an amber attention bar at the top of every authed page when the
 * signed-in user's most recent Subscription is PENDING_PAYMENT. The bar
 * names the situation in plain Spanish and carries a single CTA pointing
 * at `/checkout`, where the resume flow lives.
 *
 * Route-level suppression (hiding on `/checkout`, `/login`, etc.) is
 * handled by the `HideOnPaths` client wrapper that surrounds this
 * component in `app/layout.tsx`. Doing it that way keeps the banner a
 * pure server component and avoids fighting next-auth's middleware for
 * the request pathname.
 */
export async function PendingPaymentBanner() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return null;

  const state = await getLatestSubscriptionState(userId);
  if (state?.status !== 'PENDING_PAYMENT') return null;

  return (
    <div
      data-testid="pending-payment-banner"
      role="status"
      className="border-b border-amber-200 bg-amber-50"
    >
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-6 py-3">
        <div className="flex min-w-0 items-start gap-2 text-xs leading-snug text-amber-900 sm:items-center sm:text-sm">
          <LuTriangleAlert
            aria-hidden
            className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 sm:mt-0"
          />
          <span>
            Tu pago aún no se ha completado. Tu Sensu se activará cuando confirmes el cobro.
          </span>
        </div>
        <Link
          href="/checkout"
          data-testid="pending-payment-cta"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-600 px-3 py-1.5 text-xs font-medium tracking-tight text-white transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
        >
          Termina tu pago
          <LuArrowRight aria-hidden className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
