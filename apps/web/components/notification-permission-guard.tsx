'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { LuBellOff, LuBellRing, LuX } from 'react-icons/lu';

/**
 * NotificationPermissionGuard (Sensu Family App MVP — Step 8).
 *
 * Mounts on the compact family + operator home surfaces. Owns three
 * user-visible states:
 *
 *   1. `default` — no UI. The existing PushPromptBanner / PushToggle
 *      already handles the pre-prompt CTA on /dashboard; the compact
 *      home surfaces keep chrome minimal so the map + SOS band stay
 *      visible.
 *
 *   2. `denied` — persistent amber banner at the top of the home.
 *      Tapping it opens a modal with browser-specific "how to
 *      unblock" copy so the family can actually recover without
 *      calling support.
 *
 *   3. `denied + escalate` — full-screen escalation modal on next
 *      visit. Fires when the server confirms permission has been
 *      denied for 7+ days AND at least one push was dispatched
 *      during that window (the family missed real alerts). Dismissal
 *      is remembered client-side for another 7 days so we do not
 *      re-nag every visit.
 *
 * On every mount the guard also POSTs the fresh `Notification.permission`
 * value to the server so the escalation window is anchored to the
 * moment the user actually blocked us (server side) instead of the
 * moment they open a page.
 */

const ESCALATE_DISMISS_KEY = 'sensuEscalationDismissedAt';
const ESCALATE_DISMISS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

interface MissedSnapshot {
  permission: 'default' | 'granted' | 'denied';
  permissionUpdatedAt: string | null;
  missedPushesCount: number;
  lastMissedPushAt: string | null;
  escalate: boolean;
}

type BrowserFamily = 'chrome-android' | 'safari-ios' | 'chrome-desktop' | 'safari-desktop' | 'other';

function detectBrowser(): BrowserFamily {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);
  const isSafari = /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(ua);
  if (isIos) return 'safari-ios';
  if (isAndroid) return 'chrome-android';
  if (isSafari) return 'safari-desktop';
  return 'chrome-desktop';
}

function pushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function currentPermission(): NotificationPermission | null {
  if (typeof window === 'undefined' || !('Notification' in window)) return null;
  return Notification.permission;
}

function escalationDismissedRecently(): boolean {
  try {
    const raw = window.localStorage.getItem(ESCALATE_DISMISS_KEY);
    if (!raw) return false;
    const ts = Date.parse(raw);
    if (Number.isNaN(ts)) return false;
    return Date.now() - ts < ESCALATE_DISMISS_WINDOW_MS;
  } catch {
    return false;
  }
}

function rememberEscalationDismissal(): void {
  try {
    window.localStorage.setItem(
      ESCALATE_DISMISS_KEY,
      new Date().toISOString(),
    );
  } catch {
    // storage blocked — dismissal is only lost across a fresh page
    // load, which is an acceptable soft failure.
  }
}

const UNBLOCK_COPY: Record<BrowserFamily, string[]> = {
  'chrome-android': [
    'Abre Chrome y ve al menú (tres puntos).',
    'Toca "Ajustes del sitio" o "Site settings".',
    'Busca app.sensu.com.mx y toca "Notificaciones".',
    'Cambia el interruptor a Permitir.',
  ],
  'chrome-desktop': [
    'Toca el candado a la izquierda de la barra de dirección.',
    'Busca "Notificaciones".',
    'Cambia el permiso a Permitir.',
    'Recarga la página.',
  ],
  'safari-ios': [
    'Abre Ajustes → Notificaciones.',
    'Busca "Sensu Angela" en la lista.',
    'Activa "Permitir notificaciones".',
  ],
  'safari-desktop': [
    'Abre Safari → Ajustes → Sitios web.',
    'Elige "Notificaciones" en la barra lateral.',
    'Busca app.sensu.com.mx y cambia a Permitir.',
  ],
  other: [
    'Abre los ajustes de tu navegador.',
    'Busca los permisos del sitio app.sensu.com.mx.',
    'Cambia el permiso de Notificaciones a Permitir.',
  ],
};

export function NotificationPermissionGuard({
  variant = 'full',
}: {
  /** 'full' (default) renders the compact denied banner AND runs the
   *  server sync AND opens the escalation modal.
   *  'sync-only' skips the compact denied banner (used on `/dashboard`
   *  where `PushPromptBanner` already owns the visible denied UI) so
   *  the two components do not stack two amber pills. Sync + escalation
   *  modal still run. */
  variant?: 'full' | 'sync-only';
} = {}): React.ReactElement | null {
  const [permission, setPermission] = useState<
    NotificationPermission | null
  >(null);
  const [snapshot, setSnapshot] = useState<MissedSnapshot | null>(null);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [escalationOpen, setEscalationOpen] = useState(false);
  const browser = useMemo(detectBrowser, []);

  const syncToServer = useCallback(async (perm: NotificationPermission) => {
    try {
      await fetch('/api/user/notification-permission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permission: perm }),
      });
    } catch {
      // permission sync is a best-effort ping; a failed post does
      // not affect the render decision this mount.
    }
  }, []);

  const loadSnapshot = useCallback(async () => {
    try {
      const res = await fetch('/api/user/missed-pushes');
      if (!res.ok) return;
      const body = (await res.json()) as MissedSnapshot;
      setSnapshot(body);
      if (body.escalate && !escalationDismissedRecently()) {
        setEscalationOpen(true);
      }
    } catch {
      // ignore — the amber banner still renders on client-side
      // detection of denied so the recovery path is not blocked.
    }
  }, []);

  useEffect(() => {
    if (!pushSupported()) return;
    const perm = currentPermission();
    if (!perm) return;
    setPermission(perm);
    void syncToServer(perm);
    void loadSnapshot();
  }, [syncToServer, loadSnapshot]);

  const escalationNode =
    escalationOpen && snapshot?.escalate ? (
      <EscalationModal
        missedCount={snapshot.missedPushesCount}
        onDismiss={() => {
          rememberEscalationDismissal();
          setEscalationOpen(false);
        }}
      />
    ) : null;

  if (!permission || permission !== 'denied') {
    return escalationNode;
  }

  // sync-only variant: the caller owns the visible denied UI (e.g.
  // PushPromptBanner on /dashboard), so we skip rendering the compact
  // banner + recovery modal from here. Sync + escalation still run.
  if (variant === 'sync-only') {
    return escalationNode;
  }

  return (
    <>
      {/* Compact one-line banner (Ustym 2026-08-10 audit gap 10). Whole
          strip is tappable; the modal owns the full copy + step by
          step recovery instructions instead of the strip carrying two
          full lines of body text and eating hero real estate. */}
      <button
        type="button"
        data-testid="notification-permission-banner"
        onClick={() => setRecoveryOpen(true)}
        className="mx-3 mt-3 flex w-[calc(100%-1.5rem)] items-center justify-between gap-3 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-900 cursor-pointer hover:bg-amber-100"
      >
        <span className="flex items-center gap-2">
          <LuBellOff aria-hidden className="h-4 w-4 shrink-0 text-amber-500" />
          Notificaciones bloqueadas
        </span>
        <span
          data-testid="notification-permission-recover-btn"
          className="text-amber-900 underline underline-offset-2"
        >
          Activar
        </span>
      </button>

      {recoveryOpen && (
        <RecoveryModal
          browser={browser}
          onClose={() => setRecoveryOpen(false)}
        />
      )}

      {escalationOpen && snapshot?.escalate && (
        <EscalationModal
          missedCount={snapshot.missedPushesCount}
          onDismiss={() => {
            rememberEscalationDismissal();
            setEscalationOpen(false);
          }}
        />
      )}
    </>
  );
}

function RecoveryModal({
  browser,
  onClose,
}: {
  browser: BrowserFamily;
  onClose: () => void;
}): React.ReactElement {
  const steps = UNBLOCK_COPY[browser];
  return (
    <div
      role="dialog"
      aria-label="Cómo activar las notificaciones"
      data-testid="notification-permission-recovery-modal"
      className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-900/40 p-4 sm:items-center"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
            <LuBellRing aria-hidden className="h-5 w-5 text-sensu-500" />
            Cómo activar las notificaciones
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            data-testid="notification-permission-recovery-close"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 cursor-pointer"
          >
            <LuX aria-hidden className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Sigue estos pasos en tu navegador y regresa a esta página.
        </p>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-zinc-700">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function EscalationModal({
  missedCount,
  onDismiss,
}: {
  missedCount: number;
  onDismiss: () => void;
}): React.ReactElement {
  return (
    <div
      role="dialog"
      aria-label="Alertas perdidas esta semana"
      data-testid="notification-permission-escalation-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/60 p-4"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center gap-2 text-base font-semibold text-zinc-900">
          <LuBellOff aria-hidden className="h-6 w-6 text-rose-500" />
          Tu Angela intentó avisarte
        </div>
        <p
          className="mt-3 text-sm text-zinc-700"
          data-testid="notification-permission-escalation-count"
        >
          Recibimos {missedCount === 1 ? '1 alerta' : `${missedCount} alertas`}{' '}
          esta semana que tu teléfono no pudo mostrar porque las
          notificaciones están bloqueadas.
        </p>
        <p className="mt-2 text-sm text-zinc-700">
          Actívalas para no perder los avisos de SOS ni las caídas
          detectadas.
        </p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            data-testid="notification-permission-escalation-dismiss"
            onClick={onDismiss}
            className="inline-flex h-10 items-center rounded-full px-4 text-sm font-medium text-zinc-500 hover:bg-zinc-100 cursor-pointer"
          >
            Ahora no
          </button>
        </div>
      </div>
    </div>
  );
}
