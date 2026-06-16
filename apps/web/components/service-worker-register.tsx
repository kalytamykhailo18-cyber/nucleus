'use client';

import { useEffect } from 'react';

/**
 * Registers /sw.js once per session so the browser treats the site as
 * a PWA (installable, theme-aware, push-capable). The same SW already
 * handles `push` and `notificationclick`; registering it on every
 * page mount means push works even before the user touches the
 * notification toggle.
 *
 * No fetch caching is wired in /sw.js; we are explicitly online-only
 * until a deliberate offline strategy lands. The registration call is
 * a no-op when the browser does not expose `serviceWorker` (older
 * Safari, http://, etc.) and never throws.
 */
export function ServiceWorkerRegister(): null {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      return;
    }
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.warn('[pwa] sw registration failed', err);
      });
  }, []);
  return null;
}
