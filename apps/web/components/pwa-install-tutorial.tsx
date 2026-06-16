'use client';

import { useEffect, useState } from 'react';
import { LuShare, LuPlus, LuX } from 'react-icons/lu';

/**
 * One-time install tutorial for iOS Safari. Chrome on Android shows a
 * native "Add to Home Screen" prompt automatically when the manifest +
 * SW are present; iOS Safari does NOT, so the only way to surface the
 * install affordance there is a small visible card with the two-step
 * tutorial (Share → Add to Home Screen).
 *
 * The card is dismissable and the dismissal is remembered in
 * `localStorage` so a returning visitor never sees it again. It also
 * suppresses itself when the page is already running in standalone
 * mode (display-mode: standalone) — meaning the user already installed.
 */

const STORAGE_KEY = 'sensu_pwa_install_dismissed_v1';

function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) && !('MSStream' in window);
  const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);
  return isIos && isSafari;
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

export function PwaInstallTutorial(): React.ReactElement | null {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (!isIosSafari()) return;
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === '1') return;
    } catch {
      // localStorage blocked — show the card anyway.
    }
    setVisible(true);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Instalar Sensu en tu pantalla de inicio"
      data-testid="pwa-install-tutorial"
      className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-md rounded-2xl bg-white px-4 py-3 shadow-lg ring-1 ring-zinc-200/70 animate-fade-up"
    >
      <button
        type="button"
        aria-label="Cerrar"
        data-testid="pwa-install-tutorial-dismiss"
        onClick={() => {
          try {
            window.localStorage.setItem(STORAGE_KEY, '1');
          } catch {
            // Ignored.
          }
          setVisible(false);
        }}
        className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
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
