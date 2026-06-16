'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LuArrowRight } from 'react-icons/lu';

export function InviteClaimButton({ code }: { code: string }): React.ReactElement {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const claim = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/family-invites/${encodeURIComponent(code)}/claim`,
        { method: 'POST' },
      );
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        reason?: string;
      };
      if (body.ok || body.reason === 'already_member') {
        router.push('/dashboard');
        router.refresh();
        return;
      }
      const message =
        body.reason === 'consumed'
          ? 'Este enlace ya fue usado.'
          : body.reason === 'expired'
            ? 'Este enlace ya expiró.'
            : 'No pudimos aceptar la invitación.';
      setError(message);
    } catch {
      setError('Falla de red — vuelve a intentar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        data-testid="invite-claim-button"
        onClick={() => void claim()}
        disabled={busy}
        className="inline-flex h-10 items-center gap-1.5 rounded-full bg-sensu-500 px-5 text-sm font-medium tracking-tight text-white transition-transform hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-60 cursor-pointer"
      >
        {busy ? 'Aceptando…' : 'Aceptar invitación'}
        <LuArrowRight aria-hidden className="h-4 w-4" />
      </button>
      {error ? (
        <p
          data-testid="invite-claim-error"
          className="text-xs text-rose-700"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
