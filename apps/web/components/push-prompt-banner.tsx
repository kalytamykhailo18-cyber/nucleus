'use client';

import { useEffect, useState } from 'react';
import { LuBellRing, LuX } from 'react-icons/lu';

/**
 * Top-of-dashboard banner that prompts the family to enable push
 * notifications (Juan 2026-06-25).
 *
 * The existing `PushToggle` button lives inside the alerts-feed
 * header — it works but most families never spot it, so the SOS push
 * pipeline shipped 2026-06-24 ran to almost zero subscribers. This
 * banner sits where they actually look (above the devices section),
 * explains why notifications matter, and exposes a big single-tap
 * "Activar ahora" CTA. Once dismissed, it stays quiet for seven
 * days so a stubborn-no family is not nagged on every dashboard
 * visit.
 *
 * Render contract:
 *   - hidden when push is unsupported (e.g. Safari < 16.4)
 *   - hidden when permission already granted AND a subscription is live
 *   - hidden when permission denied (we cannot recover via JS — the
 *     existing PushToggle surfaces the "habilítalas desde la barra de
 *     URL" hint)
 *   - hidden when the user dismissed inside the past 7 days
 *   - shown otherwise (state = prompt | granted-off)
 *
 * Network shape mirrors `PushToggle` exactly — same /api/push/public-
 * key + /api/push/subscribe handshake, same service-worker registration
 * — so the server side has zero new code to land.
 */

type BannerState =
  | { kind: 'loading' }
  | { kind: 'hidden' }
  | { kind: 'prompt' }
  | { kind: 'busy' }
  | { kind: 'denied' };

const DISMISS_KEY = 'nucleus_push_prompt_dismissed_until';
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function ensureRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration('/');
  if (existing) return existing;
  return navigator.serviceWorker.register('/sw.js', { scope: '/' });
}

async function fetchPublicKey(): Promise<string> {
  const res = await fetch('/api/push/public-key');
  if (!res.ok) throw new Error(`vapid public-key ${res.status}`);
  return (await res.text()).trim();
}

function dismissedRecently(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    return Date.now() < ts;
  } catch {
    return false;
  }
}

function markDismissed(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      DISMISS_KEY,
      String(Date.now() + DISMISS_TTL_MS),
    );
  } catch {
    // Storage blocked (private mode + Safari) — accept the nag, it's
    // a per-session annoyance not a correctness failure.
  }
}

export function PushPromptBanner(): React.ReactElement | null {
  const [state, setState] = useState<BannerState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;

    async function resolveInitial(): Promise<BannerState> {
      if (typeof window === 'undefined') return { kind: 'hidden' };
      if (
        !('serviceWorker' in navigator) ||
        !('PushManager' in window) ||
        !('Notification' in window)
      ) {
        return { kind: 'hidden' };
      }
      const perm = Notification.permission;
      // Pre-existing denied is surfaced on every visit — dismissal
      // has no meaning for a state the user cannot recover from
      // without touching browser settings, so we do not honour the
      // 7 day dismissal timestamp here. The compact pill (audit
      // gap 10) makes the persistent presence cheap.
      if (perm === 'denied') return { kind: 'denied' };
      if (dismissedRecently()) return { kind: 'hidden' };
      if (perm === 'default') return { kind: 'prompt' };
      // Permission granted — check whether a live subscription exists.
      try {
        const reg = await ensureRegistration();
        const sub = await reg.pushManager.getSubscription();
        return sub ? { kind: 'hidden' } : { kind: 'prompt' };
      } catch {
        return { kind: 'prompt' };
      }
    }

    resolveInitial().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function activate(): Promise<void> {
    setState({ kind: 'busy' });
    try {
      let perm = Notification.permission;
      if (perm === 'default') {
        perm = await Notification.requestPermission();
      }
      if (perm === 'denied') {
        setState({ kind: 'denied' });
        return;
      }
      if (perm !== 'granted') {
        // User dismissed the OS-level prompt without picking — go
        // back to prompt state so they can try again.
        setState({ kind: 'prompt' });
        return;
      }
      const reg = await ensureRegistration();
      const publicKey = await fetchPublicKey();
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const json = subscription.toJSON();
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
        }),
      });
      if (!res.ok) {
        // Server refused — drop the local subscription and leave the
        // banner mounted so the family can retry without a refresh.
        await subscription.unsubscribe().catch(() => undefined);
        setState({ kind: 'prompt' });
        return;
      }
      // Success — hide the banner. PushToggle's "Notificaciones
      // activas" pill in the alerts header confirms the state.
      setState({ kind: 'hidden' });
    } catch (err) {
      console.error('push prompt activate failed', err);
      setState({ kind: 'prompt' });
    }
  }

  function dismiss(): void {
    markDismissed();
    setState({ kind: 'hidden' });
  }

  if (state.kind === 'hidden' || state.kind === 'loading') return null;

  if (state.kind === 'denied') {
    // Compact one-line pill (Ustym 2026-08-10 audit gap 10). Old
    // treatment used 3 lines of copy and dominated the top of
    // /dashboard even though most families never see this state.
    return (
      <div
        data-testid="push-prompt-banner-denied"
        className="mt-4 flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-900"
      >
        <LuBellRing aria-hidden className="h-4 w-4 shrink-0 text-amber-500" />
        <span>
          Notificaciones bloqueadas. Habilítalas desde el candado en la barra de URL.
        </span>
      </div>
    );
  }

  const busy = state.kind === 'busy';
  return (
    <div
      data-testid="push-prompt-banner"
      className="card-surface mt-6 flex flex-col items-start gap-4 rounded-3xl bg-sensu-50 px-5 py-4 ring-1 ring-sensu-200 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <LuBellRing
          aria-hidden
          className="mt-0.5 h-5 w-5 shrink-0 text-sensu-600"
        />
        <div className="min-w-0">
          <p className="text-sm font-medium tracking-tight text-zinc-900">
            Activa las notificaciones para escuchar las alertas
          </p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-600">
            Si tu familiar dispara un SOS o detectamos una caída, tu teléfono
            te avisa al instante. Tarda dos segundos en activarse.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 self-end sm:self-auto">
        <button
          type="button"
          data-testid="push-prompt-banner-dismiss"
          onClick={dismiss}
          aria-label="Recordarme después"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 hover:bg-white hover:text-zinc-700 cursor-pointer"
        >
          <LuX aria-hidden className="h-4 w-4" />
        </button>
        <button
          type="button"
          data-testid="push-prompt-banner-activate"
          disabled={busy}
          onClick={() => void activate()}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-sensu-500 px-4 text-sm font-medium text-white transition-colors hover:bg-sensu-600 disabled:opacity-60 cursor-pointer"
        >
          <LuBellRing aria-hidden className="h-4 w-4" />
          {busy ? 'Un momento…' : 'Activar ahora'}
        </button>
      </div>
    </div>
  );
}
