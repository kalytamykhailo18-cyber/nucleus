import { redirect } from 'next/navigation';
import { auth } from '@/auth';

/**
 * /app — role-aware entry point for the Sensu Family App MVP
 * (Juan 2026-08-03 pivot). The manifest's start_url points here so
 * every install of the PWA opens through this route; server reads
 * the session, then redirects to the correct home surface based on
 * role. Everything below /app assumes an authenticated session and
 * a compact, phone-first layout.
 *
 *   Unauthenticated → /login?next=/app so the buyer lands back here
 *     after signing in from a home-screen install.
 *   USER (family)   → /dashboard (the /app/family variant was killed
 *     in the 2026-08-10 audit — it duplicated /dashboard with strictly
 *     less content; the redirect stub at /app/family carries any old
 *     ?alert= deep link through to /dashboard as well).
 *   CALLCENTER      → /app/operator
 *   ADMIN / SALES / anything else → /dashboard, where the full web
 *     panel lives (they use the desktop surface, not the phone one).
 */
export default async function AppEntryPage(): Promise<never> {
  const session = await auth();
  const user = session?.user as
    | { id?: string; role?: 'USER' | 'ADMIN' | 'CALLCENTER' | 'SALES' }
    | undefined;

  if (!user?.id) {
    redirect('/login?next=/app');
  }
  if (user.role === 'CALLCENTER') {
    redirect('/app/operator');
  }
  redirect('/dashboard');
}
