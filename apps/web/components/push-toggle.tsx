'use client';

import { useEffect, useState } from 'react';
import { LuBellOff, LuBellRing, LuCircleAlert } from 'react-icons/lu';

/**
 * "Activar notificaciones" toggle for the dashboard.
 *
 * State machine:
 *   - unsupported    → browser can't do push at all (Safari < 16.4, etc.)
 *   - prompt         → permission default, never asked
 *   - granted-on     → permission granted AND we have a live subscription
 *   - granted-off    → permission granted, no subscription (revoked)
 *   - denied         → permission denied, can't recover via JS
 *
 * The button is intentionally low-stakes: pressing once subscribes, the
 * server stores the PushSubscription, the worker fans out alerts. The
 * inverse "desactivar" path unsubscribes and tells the server.
 *
 * No polling — service-worker registration + getSubscription() resolves
 * to the real state on mount. We re-check after every action.
 */

type PushState =
  | { kind: 'idle' }
  | { kind: 'unsupported' }
  | { kind: 'prompt' }
  | { kind: 'granted-on' }
  | { kind: 'granted-off' }
  | { kind: 'denied' }
  | { kind: 'busy' };

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

export function PushToggle() {
  const [state, setState] = useState<PushState>({ kind: 'idle' });

  // Resolve initial state on mount.
  useEffect(() => {
    let cancelled = false;

    async function resolveInitial(): Promise<PushState> {
      if (typeof window === 'undefined') return { kind: 'idle' };
      if (
        !('serviceWorker' in navigator) ||
        !('PushManager' in window) ||
        !('Notification' in window)
      ) {
        return { kind: 'unsupported' };
      }
      const perm = Notification.permission;
      if (perm === 'denied') return { kind: 'denied' };
      if (perm === 'default') return { kind: 'prompt' };
      try {
        const reg = await ensureRegistration();
        const sub = await reg.pushManager.getSubscription();
        return sub ? { kind: 'granted-on' } : { kind: 'granted-off' };
      } catch {
        return { kind: 'granted-off' };
      }
    }

    resolveInitial().then((next) => {
      if (!cancelled) setState(next);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  async function turnOn(): Promise<void> {
    setState({ kind: 'busy' });
    try {
      let perm = Notification.permission;
      if (perm === 'default') {
        perm = await Notification.requestPermission();
      }
      if (perm !== 'granted') {
        setState(perm === 'denied' ? { kind: 'denied' } : { kind: 'prompt' });
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
        // Server refused — drop the local subscription so we don't leave
        // a dangling browser-side row that the server doesn't know about.
        await subscription.unsubscribe();
        setState({ kind: 'granted-off' });
        return;
      }
      setState({ kind: 'granted-on' });
    } catch (err) {
      console.error('push subscribe failed', err);
      setState({ kind: 'granted-off' });
    }
  }

  async function turnOff(): Promise<void> {
    setState({ kind: 'busy' });
    try {
      const reg = await ensureRegistration();
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {
          // Ignore — we still want to drop the local subscription.
        });
        await sub.unsubscribe();
      }
      setState({ kind: 'granted-off' });
    } catch (err) {
      console.error('push unsubscribe failed', err);
      setState({ kind: 'granted-on' });
    }
  }

  if (state.kind === 'idle' || state.kind === 'unsupported') {
    if (state.kind === 'unsupported') {
      return (
        <p
          data-testid="push-unsupported"
          className="text-xs text-zinc-500"
        >
          Las notificaciones en navegador no están disponibles aquí — usa la
          app móvil para alertas en tiempo real.
        </p>
      );
    }
    return null;
  }

  if (state.kind === 'denied') {
    // 2026-08-10 audit: PushPromptBanner already surfaces the denied
    // state as a compact pill at the top of /dashboard, and rendering
    // this longer inline block inside the alerts-feed header stacked
    // a second amber message on the same page. Cannot recover via
    // JS anyway, so we hide the toggle entirely in denied state and
    // let the top pill be the sole signal.
    return null;
  }

  const isOn = state.kind === 'granted-on';
  const busy = state.kind === 'busy';

  return (
    <button
      type="button"
      data-testid="push-toggle"
      data-push-state={state.kind}
      disabled={busy}
      onClick={() => (isOn ? turnOff() : turnOn())}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium tracking-tight transition-colors ${
        isOn
          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
          : 'bg-sensu-500 text-white hover:bg-sensu-600'
      } disabled:opacity-60`}
    >
      {isOn ? (
        <LuBellRing aria-hidden className="h-4 w-4" />
      ) : (
        <LuBellOff aria-hidden className="h-4 w-4" />
      )}
      {busy
        ? 'Un momento…'
        : isOn
          ? 'Notificaciones activas'
          : 'Activar notificaciones'}
    </button>
  );
}
