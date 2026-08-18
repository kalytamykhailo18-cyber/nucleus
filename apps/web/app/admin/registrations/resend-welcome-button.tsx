'use client';

import { useState } from 'react';
import { LuMail, LuCircleCheck, LuLoader, LuCircleAlert } from 'react-icons/lu';

/**
 * Per-row "Reenviar correo" button for /admin/registrations.
 *
 * Renders ONLY on rows where `questionnaireCompleted = false` (see
 * page.tsx). On click POSTs to the resend-welcome route, then flips
 * to a 6-second "Enviado" confirmation before resetting so the admin
 * can fire it again if needed (a customer may want a second nudge a
 * week later).
 *
 * Inline state, no toast library — keeps the dependency surface flat.
 */
export function ResendWelcomeButton({
  subscriptionId,
}: {
  subscriptionId: string;
}): React.ReactElement {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>(
    'idle',
  );
  const [error, setError] = useState<string | null>(null);

  const send = async (): Promise<void> => {
    setState('sending');
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/registrations/${subscriptionId}/resend-welcome`,
        { method: 'POST' },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(body.error ?? 'send_failed');
        setState('error');
        return;
      }
      setState('sent');
      window.setTimeout(() => setState('idle'), 6_000);
    } catch {
      setError('network');
      setState('error');
    }
  };

  if (state === 'sent') {
    return (
      <span
        data-testid={`admin-row-${subscriptionId}-resend-sent`}
        className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200"
      >
        <LuCircleCheck aria-hidden className="h-3 w-3" />
        Enviado
      </span>
    );
  }

  if (state === 'error') {
    return (
      <button
        type="button"
        onClick={() => void send()}
        data-testid={`admin-row-${subscriptionId}-resend-error`}
        className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-200 transition-colors hover:bg-rose-100 cursor-pointer"
        title={error ?? 'Error de red'}
      >
        <LuCircleAlert aria-hidden className="h-3 w-3" />
        Reintentar
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void send()}
      disabled={state === 'sending'}
      data-testid={`admin-row-${subscriptionId}-resend`}
      className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-xs font-medium text-zinc-700 ring-1 ring-inset ring-zinc-200 transition-colors hover:bg-zinc-50 disabled:opacity-60 cursor-pointer"
    >
      {state === 'sending' ? (
        <LuLoader aria-hidden className="h-3 w-3 animate-spin" />
      ) : (
        <LuMail aria-hidden className="h-3 w-3" />
      )}
      Reenviar
    </button>
  );
}
