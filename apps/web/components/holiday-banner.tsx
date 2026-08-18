import { LuGift } from 'react-icons/lu';
import { prisma } from '@/lib/db';

/**
 * Auto-managed holiday promo banner (Juan 2026-06-22). Pulls the
 * latest active PromoCode whose channel begins with "holiday-" and
 * renders it as a slim ribbon across the top of /planes and /. When
 * the promo expires, the banner disappears on its own.
 *
 * Rendered inline as an async server component so callers can drop it
 * into a server page with no client-side fetch.
 */
export async function HolidayBanner(): Promise<React.ReactElement | null> {
  const now = new Date();
  const holiday = await prisma.promoCode.findFirst({
    where: {
      channel: { startsWith: 'holiday-' },
      validFrom: { lte: now },
      validUntil: { gte: now },
    },
    orderBy: { percentOffBps: 'desc' },
    select: { label: true },
  });
  if (!holiday) return null;

  return (
    <div
      data-testid="holiday-banner"
      className="flex w-full items-center justify-center bg-sensu-50 px-4 py-2 text-xs font-medium text-sensu-800 ring-1 ring-inset ring-sensu-200"
    >
      <LuGift aria-hidden className="mr-2 h-4 w-4 text-sensu-600" />
      <span>{holiday.label}</span>
    </div>
  );
}
