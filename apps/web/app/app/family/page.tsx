import { redirect } from 'next/navigation';
import { auth } from '@/auth';

/**
 * /app/family was killed in the audit wave (Ustym 2026-08-10 gap 1) —
 * the compact family home duplicated `/dashboard` while providing
 * strictly less information (no per-device battery, no per-device
 * map link, no 24/7-active reassurance tile). Juan already installs
 * `/dashboard` via Safari and uses it as his primary surface.
 *
 * This route is preserved as a role-aware redirect stub so:
 *   - Old push-notification URLs from Steps 3-6 (which carry
 *     `?alert=<id>`) still land the family on a working surface.
 *   - Any browser bookmarks from the earlier `/app/family` build
 *     do not 404.
 *   - A CALLCENTER account hitting the URL still lands on
 *     `/app/operator` instead of the family dashboard.
 */
export const dynamic = 'force-dynamic';

export default async function AppFamilyRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<never> {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') query.set(key, value);
    else if (Array.isArray(value) && value[0]) query.set(key, value[0]);
  }
  const qs = query.toString();

  if (role === 'CALLCENTER') {
    redirect(qs ? `/app/operator?${qs}` : '/app/operator');
  }
  redirect(qs ? `/dashboard?${qs}` : '/dashboard');
}
