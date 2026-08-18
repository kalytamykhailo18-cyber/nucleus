'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { LuDownload, LuPlus, LuShare, LuX } from 'react-icons/lu';

/**
 * PWA install prompt (Sensu Family App MVP — Step 7).
 *
 * Three states, one component:
 *
 *   1. Chromium / Android Chrome: capture `beforeinstallprompt`, defer
 *      it, render our own bottom-sheet with a real "Instalar" button
 *      that calls the deferred prompt. This is the ONLY way the native
 *      install prompt fires under our control — Chrome will not show
 *      it a second time if we let it pass.
 *
 *   2. iOS Safari: no browser event ever fires. We detect the UA and
 *      render a manual walkthrough (Share → Agregar a inicio) with
 *      inline icons. iOS Chrome / iOS Firefox cannot install a PWA
 *      to the home screen, so we treat them the same as iOS Safari —
 *      the copy still works because those browsers ALSO expose the
 *      Share sheet.
 *
 *   3. Already installed (running in `display-mode: standalone`) →
 *      render nothing.
 *
 * Dismissal is remembered in `localStorage.sensuInstallPromptDismissedAt`
 * as an ISO timestamp. A dismissal within the last 7 days suppresses
 * the sheet; after that window it re-appears so we do not silently
 * abandon a user who forgot they said "not now".
 *
 * The layout mounts this in the root tree so every family + call
 * center + marketing surface can offer install. It is hidden inside
 * `<HideOnPaths>` on /admin routes where operators use desktop.
 */

const DISMISS_KEY = 'sensuInstallPromptDismissedAt';
const DISMISS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

interface DeferredPrompt extends Event {
  prompt: () => Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && 'ontouchend' in document);
  const isSafari = /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(ua);
  return isIos && isSafari;
}

function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua);
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const navStandalone = (navigator as Navigator & { standalone?: boolean })
    .standalone;
  return (
    navStandalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  );
}

function isDismissedRecently(): boolean {
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = Date.parse(raw);
    if (Number.isNaN(ts)) return false;
    return Date.now() - ts < DISMISS_WINDOW_MS;
  } catch {
    return false;
  }
}

export function PwaInstallTutorial(): React.ReactElement | null {
  const [visible, setVisible] = useState(false);
  const [variant, setVariant] = useState<'chromium' | 'ios' | null>(null);
  const deferredRef = useRef<DeferredPrompt | null>(null);

  const rememberDismissal = useCallback(() => {
    try {
      window.localStorage.setItem(DISMISS_KEY, new Date().toISOString());
    } catch {
      // localStorage may be blocked in private mode — the sheet still
      // hides for this session, it just may re-appear next visit.
    }
  }, []);

  useEffect(() => {
    if (isStandalone()) return;
    if (isDismissedRecently()) return;

    const onBeforeInstallPrompt = (event: Event) => {
      // Chromium fires this only when the page is genuinely
      // installable (HTTPS + manifest + active SW + engagement). We
      // capture the event so `prompt()` can be called from the button
      // handler instead of the browser's native mini-infobar.
      event.preventDefault();
      deferredRef.current = event as DeferredPrompt;
      setVariant('chromium');
      setVisible(true);
    };

    const onAppInstalled = () => {
      // Site was installed via the native flow (from our button OR
      // from the browser menu). Suppress the sheet for the current
      // session and remember dismissal so a fresh reload does not
      // re-show it.
      setVisible(false);
      deferredRef.current = null;
      rememberDismissal();
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    // iOS Safari never fires beforeinstallprompt. Fall back to the
    // manual walkthrough if the device is iOS AND the browser is
    // Safari-family (regular Chrome for iOS also uses WebKit; the
    // Share sheet is available in both — so we surface the tutorial
    // on any iOS device, not just Safari).
    if (isIosDevice()) {
      setVariant('ios');
      setVisible(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, [rememberDismissal]);

  const onDismiss = useCallback(() => {
    rememberDismissal();
    setVisible(false);
  }, [rememberDismissal]);

  const onInstall = useCallback(async () => {
    const evt = deferredRef.current;
    if (!evt) return;
    try {
      const { outcome } = await evt.prompt();
      if (outcome === 'accepted' || outcome === 'dismissed') {
        // Either way the browser will not fire beforeinstallprompt
        // again for this session; close the sheet. If they dismissed
        // we still remember it so we do not re-nag on a reload.
        setVisible(false);
        rememberDismissal();
      }
    } catch {
      // Some browsers throw if prompt() is called twice or too late.
      // Close the sheet defensively; a re-navigation will re-arm the
      // handler if the browser fires beforeinstallprompt again.
      setVisible(false);
    } finally {
      deferredRef.current = null;
    }
  }, [rememberDismissal]);

  if (!visible || !variant) return null;

  const commonWrapperClass =
    'fixed inset-x-3 bottom-3 z-40 mx-auto max-w-md rounded-2xl bg-white px-4 py-3 shadow-lg ring-1 ring-zinc-200/70 animate-fade-up';

  if (variant === 'chromium') {
    return (
      <div
        role="dialog"
        aria-label="Instalar Sensu en tu teléfono"
        data-testid="pwa-install-tutorial"
        data-variant="chromium"
        className={commonWrapperClass}
      >
        <button
          type="button"
          aria-label="Cerrar"
          data-testid="pwa-install-tutorial-dismiss"
          onClick={onDismiss}
          className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 cursor-pointer"
        >
          <LuX aria-hidden className="h-4 w-4" />
        </button>
        <p className="pr-6 text-sm font-medium text-zinc-900">
          Instala Sensu en tu teléfono
        </p>
        <p className="mt-1 text-xs text-zinc-600">
          Recibes las alertas con sonido y abres el panel familiar con un
          toque.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            data-testid="pwa-install-tutorial-install-btn"
            onClick={onInstall}
            className="inline-flex h-9 items-center gap-2 rounded-full bg-sensu-500 px-4 text-xs font-medium tracking-tight text-white transition-transform hover:-translate-y-0.5 active:scale-[0.98] cursor-pointer"
          >
            <LuDownload aria-hidden className="h-3.5 w-3.5" />
            Instalar
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex h-9 items-center rounded-full px-3 text-xs font-medium text-zinc-500 hover:bg-zinc-100 cursor-pointer"
          >
            Ahora no
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="Instalar Sensu en tu pantalla de inicio"
      data-testid="pwa-install-tutorial"
      data-variant="ios"
      className={commonWrapperClass}
    >
      <button
        type="button"
        aria-label="Cerrar"
        data-testid="pwa-install-tutorial-dismiss"
        onClick={onDismiss}
        className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 cursor-pointer"
      >
        <LuX aria-hidden className="h-4 w-4" />
      </button>
      <p className="pr-6 text-sm font-medium text-zinc-900">
        Instala Sensu en tu pantalla de inicio
      </p>
      <p className="mt-1 text-xs text-zinc-600">
        Para abrir Sensu como una app, toca{' '}
        <span className="inline-flex items-center gap-1 font-medium text-sky-700">
          <LuShare aria-hidden className="h-3.5 w-3.5" />
          Compartir
        </span>{' '}
        y luego{' '}
        <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
          <LuPlus aria-hidden className="h-3.5 w-3.5" />
          Agregar a inicio
        </span>
        .
      </p>
    </div>
  );
}
