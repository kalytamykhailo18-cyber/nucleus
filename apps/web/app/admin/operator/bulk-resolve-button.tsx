'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LuBrush, LuCircleAlert } from 'react-icons/lu';
import { ConfirmModal } from '@/components/confirm-modal';

/**
 * Bulk-resolve stale alerts button for the operator board
 * (Juan 2026-06-30). Fires POST /api/admin/operator/bulk-resolve which
 * closes every unresolved EviewEvent older than 24 h. The threshold
 * is server-side hard-floored at 6 h so an over-zealous click can
 * never sweep fresh SOS rows out of the queue.
 *
 * UX: click → ConfirmModal (the same destructive-confirm primitive
 * the rest of admin uses) → POST → inline summary
 * ("Resueltas N") → router.refresh() so the queue re-renders with
 * the closed rows faded.
 */
export function BulkResolveButton(): React.ReactElement {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<
    { count: number; capped: boolean } | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  const confirm = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/operator/bulk-resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ olderThanHours: 24 }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? 'bulk_resolve_failed');
        return;
      }
      const body = (await res.json()) as { count: number; capped?: boolean };
      setResult({ count: body.count, capped: body.capped ?? false });
      router.refresh();
    } catch {
      setError('network');
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  return (
    <>
      <button
        type="button"
        data-testid="admin-operator-bulk-resolve"
        onClick={() => {
          setResult(null);
          setError(null);
          setOpen(true);
        }}
        className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200 transition-colors hover:bg-zinc-50 cursor-pointer"
        title="Cerrar todas las alertas viejas que ya fueron atendidas pero no se marcaron resueltas"
      >
        <LuBrush aria-hidden className="h-3.5 w-3.5" />
        Limpiar viejas
      </button>

      {result ? (
        <span
          data-testid="admin-operator-bulk-resolve-result"
          className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200"
        >
          {result.count === 0
            ? 'Nada que limpiar'
            : `Resueltas ${result.count}`}
          {result.capped ? ' (tope, vuelve a hacer clic)' : ''}
        </span>
      ) : null}

      {error ? (
        <span
          data-testid="admin-operator-bulk-resolve-error"
          className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-200"
        >
          <LuCircleAlert aria-hidden className="h-3 w-3" />
          {error}
        </span>
      ) : null}

      <ConfirmModal
        open={open}
        title="Limpiar alertas viejas"
        body="Voy a marcar como Resueltas todas las alertas sin resolver con más de 24 horas. Las alertas más nuevas que 24 horas se quedan en cola para revisarse a mano."
        confirmLabel="Sí, limpiar"
        busyLabel="Marcando…"
        busy={busy}
        onCancel={() => !busy && setOpen(false)}
        onConfirm={() => void confirm()}
        testId="admin-operator-bulk-resolve-confirm"
      />
    </>
  );
}
