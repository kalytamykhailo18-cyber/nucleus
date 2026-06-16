'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Force a full reload when an authenticated page is restored from the
 * browser's back-forward cache (bfcache).
 *
 * Without this, Safari (and some Chrome configurations) keep the
 * rendered admin/dashboard HTML in memory after the user logs out —
 * pressing Back shows the page as if they were still signed in, even
 * though the session cookie is gone. The server-side gate kicks in
 * only on the next navigation that triggers an actual fetch.
 *
 * `Cache-Control: no-store` is supposed to prevent bfcache, but Safari
 * ignores it for same-origin navigations. The `pageshow` event with
 * `persisted=true` is the universal bfcache restore signal — when it
 * fires on a protected route, reload from the server so middleware can
 * redirect to /login.
 */
const PROTECTED_PREFIXES = ['/dashboard', '/profile', '/geofences', '/admin'];

export function BfcacheGuard(): null {
  const pathname = usePathname();
  useEffect(() => {
    const onShow = (e: PageTransitionEvent): void => {
      if (!e.persisted) return;
      const path = window.location.pathname;
      const isProtected = PROTECTED_PREFIXES.some(
        (p) => path === p || path.startsWith(p + '/'),
      );
      if (isProtected) window.location.reload();
    };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, [pathname]);
  return null;
}
