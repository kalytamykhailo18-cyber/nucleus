'use client';

import { useMemo, useState } from 'react';
import type { OperatorBoardAlert } from '@/lib/operator-board';

/**
 * Operator home client — active-alerts strip + shift toggle.
 *
 * Step 5 (Juan 2026-08-07): the toggle is now wired to
 * PATCH /api/user/shift so a flip persists across sessions and the
 * push dispatcher can filter standard-tier alerts by shift state.
 * Critical-tier alerts (sos, fall_detection) always deliver
 * regardless — the toggle only affects standard-tier routing.
 *
 * The button is disabled when `shiftEditable` is false (ADMIN role
 * previewing the operator surface, for example) so the toggle never
 * writes an onShift flag on a non-CALLCENTER user.
 */

const OPEN_EVENT_TYPES: Array<OperatorBoardAlert['eventType']> = [
  'sos',
  'fall_detection',
];

export function AppOperatorHomeClient({
  initialAlerts,
  initialOnShift,
  shiftEditable,
}: {
  initialAlerts: OperatorBoardAlert[];
  initialOnShift: boolean;
  shiftEditable: boolean;
}): React.ReactElement {
  const [onShift, setOnShift] = useState(initialOnShift);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeAlerts = useMemo(
    () =>
      initialAlerts.filter(
        (a) => !a.isResolved && OPEN_EVENT_TYPES.includes(a.eventType),
      ),
    [initialAlerts],
  );

  async function flip(next: boolean): Promise<void> {
    if (!shiftEditable || busy) return;
    // Optimistic UI so the toggle feels instant even on a flaky
    // connection; revert on error so the operator can retry.
    setOnShift(next);
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/user/shift', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onShift: next }),
      });
      if (!res.ok) {
        setOnShift(!next);
        setError(
          res.status === 403
            ? 'Solo los operadores pueden cambiar el turno.'
            : 'No se pudo actualizar el turno.',
        );
      }
    } catch (err) {
      setOnShift(!next);
      setError('Sin conexión. Reintentá en un momento.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-4 mt-4 rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Estado del turno
          </p>
          <p
            data-testid="app-operator-shift-label"
            className="mt-1 text-sm font-medium text-zinc-900"
          >
            {onShift ? 'En turno' : 'Fuera de turno'}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={onShift}
          aria-disabled={!shiftEditable || busy}
          data-testid="app-operator-shift-toggle"
          disabled={!shiftEditable || busy}
          onClick={() => flip(!onShift)}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
            onShift ? 'bg-emerald-500' : 'bg-zinc-300'
          } ${shiftEditable ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              onShift ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {error ? (
        <p
          data-testid="app-operator-shift-error"
          className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-inset ring-rose-200"
        >
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex items-center justify-between rounded-xl bg-zinc-50 px-3 py-2 ring-1 ring-zinc-100">
        <span className="text-xs font-medium text-zinc-600">
          Alertas activas ahora
        </span>
        <span
          data-testid="app-operator-active-count"
          className="text-base font-semibold tabular-nums text-zinc-900"
        >
          {activeAlerts.length}
        </span>
      </div>
    </div>
  );
}
