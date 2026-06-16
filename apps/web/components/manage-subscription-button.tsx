'use client';

import { useState } from 'react';
import { LuArrowUpRight, LuLoaderCircle } from 'react-icons/lu';

/**
 * Single-click entry into Stripe's hosted Customer Portal.
 *
 * Stripe owns the surface — the Portal handles card updates, invoice
 * history, plan changes, and cancellation. We just mint a session via
 * /api/billing-portal/create and redirect. The Portal redirects back
 * to /dashboard when the customer is done.
 */
export function ManageSubscriptionButton(): React.ReactElement {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick(): Promise<void> {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/billing-portal/create', {
        method: 'POST',
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? `Error ${res.status}`);
      }
      const body = (await res.json()) as { url?: string };
      if (!body.url) throw new Error('Portal URL missing from response');
      window.location.href = body.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo abrir');
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        data-testid="manage-subscription"
        className="inline-flex h-10 items-center gap-2 rounded-full bg-zinc-900 px-5 text-sm font-medium tracking-tight text-white transition-transform duration-200 ease-[cubic-bezier(.32,.72,0,1)] hover:-translate-y-0.5 hover:bg-zinc-800 active:scale-[0.98] disabled:cursor-progress disabled:opacity-60 disabled:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
      >
        {busy ? (
          <LuLoaderCircle aria-hidden className="h-4 w-4 animate-spin" />
        ) : (
          <LuArrowUpRight aria-hidden className="h-4 w-4" />
        )}
        {busy ? 'Abriendo…' : 'Administrar suscripción'}
      </button>
      {error && (
        <p
          role="alert"
          data-testid="manage-subscription-error"
          className="text-xs text-rose-600"
        >
          {error}
        </p>
      )}
    </div>
  );
}
