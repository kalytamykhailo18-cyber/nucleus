'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { LuRefreshCcw, LuWifiOff } from 'react-icons/lu';

/**
 * ConnectivityToasts (Sensu Family App MVP — Step 9).
 *
 * Three non-blocking UI seams the family app needs to feel like an
 * app instead of a webpage:
 *
 *   1. Offline toast — listens for the browser's `online`/`offline`
 *      events and renders a bottom-anchored bar when the network is
 *      unreachable, so the family understands why alerts might not
 *      be arriving.
 *
 *   2. Update-available toast — checks `navigator.serviceWorker` for
 *      a `waiting` worker (a new SW that was installed but is
 *      blocked behind the current one). Renders a "Nueva versión
 *      disponible" toast with a "Recargar" button that posts
 *      `sensu:sw-skip-waiting` to the waiting worker, which then
 *      calls `skipWaiting()` on next controller change and reloads
 *      the tab.
 *
 *   3. Session-expired modal — wraps `window.fetch` so any 401
 *      response mounts a soft re-login modal instead of a hard
 *      redirect that would drop the user mid-alert-handling. The
 *      modal preserves the current URL as `?next=…` on the /login
 *      link so returning lands the user right back where they were.
 *
 * Renders in the root layout so every family / operator / marketing
 * page picks up the same connectivity signal.
 */

export function ConnectivityToasts(): React.ReactElement | null {
  return (
    <>
      <OfflineToast />
      <UpdateAvailableToast />
      <SessionExpiredGuard />
    </>
  );
}

// ---- Offline toast ---------------------------------------------------

function OfflineToast(): React.ReactElement | null {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  if (!offline) return null;
  return (
    <div
      role="status"
      data-testid="offline-toast"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-md items-center gap-2 rounded-2xl bg-zinc-900 px-4 py-3 text-sm text-white shadow-lg"
    >
      <LuWifiOff aria-hidden className="h-4 w-4 shrink-0" />
      <span>Sin conexión. Reintentamos cuando el internet vuelva.</span>
    </div>
  );
}

// ---- Update-available toast ------------------------------------------

function UpdateAvailableToast(): React.ReactElement | null {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    let cancelled = false;

    const attach = (reg: ServiceWorkerRegistration) => {
      if (cancelled) return;
      if (reg.waiting) setWaitingWorker(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            setWaitingWorker(installing);
          }
        });
      });
    };

    navigator.serviceWorker.getRegistration('/').then((reg) => {
      if (reg) attach(reg);
    });
    navigator.serviceWorker.ready.then((reg) => attach(reg));

    // Test seam: the connectivity spec dispatches this event with the
    // captured worker to avoid having to install a real second SW.
    const onFake = (ev: Event) => {
      const detail = (ev as CustomEvent<{ worker?: ServiceWorker }>).detail;
      if (detail?.worker) setWaitingWorker(detail.worker);
      else if (navigator.serviceWorker.controller) {
        setWaitingWorker(navigator.serviceWorker.controller);
      }
    };
    window.addEventListener('sensu:test-fake-sw-waiting', onFake);
    // Hydration marker so the E2E spec can `waitForFunction` on it and
    // avoid racing the dispatch ahead of the listener attach.
    (window as Window & { __sensuUpdateToastMounted?: boolean })
      .__sensuUpdateToastMounted = true;

    return () => {
      cancelled = true;
      window.removeEventListener('sensu:test-fake-sw-waiting', onFake);
    };
  }, []);

  const reload = useCallback(() => {
    if (waitingWorker) {
      try {
        waitingWorker.postMessage({ type: 'sensu:sw-skip-waiting' });
      } catch {
        // ignore — fall back to a plain reload
      }
    }
    window.location.reload();
  }, [waitingWorker]);

  if (!waitingWorker) return null;
  return (
    <div
      role="status"
      data-testid="update-available-toast"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 text-sm text-zinc-900 shadow-lg ring-1 ring-zinc-200"
    >
      <span className="flex items-center gap-2">
        <LuRefreshCcw aria-hidden className="h-4 w-4 text-sensu-500" />
        Nueva versión disponible.
      </span>
      <button
        type="button"
        data-testid="update-available-toast-reload"
        onClick={reload}
        className="inline-flex h-8 items-center rounded-full bg-sensu-500 px-3 text-xs font-medium text-white hover:bg-sensu-600 cursor-pointer"
      >
        Recargar
      </button>
    </div>
  );
}

// ---- Session expired modal -------------------------------------------

function SessionExpiredGuard(): React.ReactElement | null {
  const [expired, setExpired] = useState(false);
  const nextPath = useRef<string>('/');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const trigger = () => {
      try {
        nextPath.current = window.location.pathname + window.location.search;
      } catch {
        nextPath.current = '/';
      }
      setExpired(true);
    };

    const flag = window as Window & { __sensuFetchWrapped?: boolean };
    if (!flag.__sensuFetchWrapped) {
      flag.__sensuFetchWrapped = true;
      const original = window.fetch.bind(window);
      window.fetch = async (...args) => {
        const res = await original(...args);
        if (res.status === 401) {
          // Ignore 401s from the auth endpoints themselves — those
          // are expected on a fresh sign-in flow. Only route-guard
          // 401s should surface the modal.
          const url =
            typeof args[0] === 'string'
              ? args[0]
              : args[0] instanceof Request
                ? args[0].url
                : (args[0] as URL).toString();
          if (!url.includes('/api/auth/')) {
            window.dispatchEvent(new Event('sensu:session-expired'));
          }
        }
        return res;
      };
    }

    window.addEventListener('sensu:session-expired', trigger);
    return () => {
      window.removeEventListener('sensu:session-expired', trigger);
    };
  }, []);

  if (!expired) return null;
  const loginUrl = `/login?next=${encodeURIComponent(nextPath.current)}`;
  return (
    <div
      role="dialog"
      aria-label="Sesión expirada"
      data-testid="session-expired-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 p-4"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <p className="text-base font-semibold text-zinc-900">
          Tu sesión expiró
        </p>
        <p className="mt-2 text-sm text-zinc-600">
          Vuelve a iniciar sesión para seguir viendo las alertas de tu
          familiar. Regresamos a esta pantalla en cuanto entres.
        </p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            data-testid="session-expired-dismiss"
            onClick={() => setExpired(false)}
            className="inline-flex h-9 items-center rounded-full px-3 text-xs font-medium text-zinc-500 hover:bg-zinc-100 cursor-pointer"
          >
            Ahora no
          </button>
          <a
            href={loginUrl}
            data-testid="session-expired-signin"
            className="inline-flex h-9 items-center rounded-full bg-sensu-500 px-4 text-xs font-medium text-white hover:bg-sensu-600 cursor-pointer"
          >
            Iniciar sesión
          </a>
        </div>
      </div>
    </div>
  );
}
