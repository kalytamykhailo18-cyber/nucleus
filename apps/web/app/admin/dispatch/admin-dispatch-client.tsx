'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LuPackage, LuRadio, LuMail, LuPhone, LuMapPin } from 'react-icons/lu';
import { Modal } from '@/components/modal';
import { ConfirmModal } from '@/components/confirm-modal';
import { PaginationNav } from '@/components/pagination-nav';
import type {
  AwaitingShipmentRow,
  AwaitingActivationRow,
} from '@/lib/dispatch';

interface NavMeta {
  currentPage: number;
  totalPages: number;
  totalRows: number;
  pageSize: number;
  baseHref: string;
  pageParam: string;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-MX', {
    timeZone: 'America/Mexico_City',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function AdminDispatchClient({
  initialShipping,
  initialActivating,
  shippingPagination,
  activatingPagination,
  focusSubscriptionId = null,
}: {
  initialShipping: AwaitingShipmentRow[];
  initialActivating: AwaitingActivationRow[];
  shippingPagination: NavMeta;
  activatingPagination: NavMeta;
  focusSubscriptionId?: string | null;
}): React.ReactElement {
  const router = useRouter();
  const [pendingShip, setPendingShip] = useState<AwaitingShipmentRow | null>(null);
  const [pendingActivate, setPendingActivate] =
    useState<AwaitingActivationRow | null>(null);
  const [imei, setImei] = useState('');
  const [devicePhone, setDevicePhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Refs for the focus + scroll-into-view behaviour driven by ?focus=…
  // on /admin/dispatch (cross-link from /admin/registrations).
  const rowRefs = useRef<Map<string, HTMLLIElement>>(new Map());
  const [focusedId, setFocusedId] = useState<string | null>(null);

  useEffect(() => {
    if (!focusSubscriptionId) return;
    const el = rowRefs.current.get(focusSubscriptionId);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setFocusedId(focusSubscriptionId);
    // If the focused subscription is in the activation queue, auto-open
    // the Emparejar modal so the admin lands one click ahead.
    const activateRow = initialActivating.find(
      (r) => r.subscriptionId === focusSubscriptionId,
    );
    if (activateRow) {
      setPendingActivate(activateRow);
    }
    const t = window.setTimeout(() => setFocusedId(null), 2500);
    return () => window.clearTimeout(t);
  }, [focusSubscriptionId, initialActivating]);

  const close = (): void => {
    if (busy) return;
    setPendingShip(null);
    setPendingActivate(null);
    setImei('');
    setDevicePhone('');
    setError(null);
  };

  const confirmShip = async (): Promise<void> => {
    if (!pendingShip) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/dispatch/${pendingShip.subscriptionId}/mark-shipped`,
        { method: 'POST' },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.message ?? 'No se pudo marcar como enviado.');
        return;
      }
      setPendingShip(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const confirmActivate = async (): Promise<void> => {
    if (!pendingActivate) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/dispatch/${pendingActivate.subscriptionId}/activate-device`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            eviewDeviceId: imei.trim().toUpperCase(),
            phoneNumber: devicePhone.trim() ? devicePhone.trim() : undefined,
          }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.message ?? 'No se pudo activar el dispositivo.');
        return;
      }
      setPendingActivate(null);
      setImei('');
      setDevicePhone('');
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-8 space-y-10">
      <section data-testid="dispatch-awaiting-shipment">
        <h2 className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
          <LuPackage aria-hidden className="h-4 w-4 text-amber-500" />
          Esperando envío · {shippingPagination.totalRows}
        </h2>
        {initialShipping.length === 0 ? (
          <p
            data-testid="dispatch-shipping-empty"
            className="mt-4 rounded-3xl bg-white p-8 text-sm text-zinc-500 ring-1 ring-zinc-200"
          >
            No hay registros esperando envío. Cuando alguien completa el
            cuestionario, aparece aquí.
          </p>
        ) : (
          <>
            <PaginationNav
              {...shippingPagination}
              testIdPrefix="dispatch-shipping-pagination"
              position="top"
            />
            <ul className="mt-2 grid gap-3">
            {initialShipping.map((r) => (
              <li
                key={r.subscriptionId}
                data-testid={`dispatch-ship-row-${r.subscriptionId}`}
                data-focused={focusedId === r.subscriptionId ? 'true' : undefined}
                ref={(el) => {
                  if (el) rowRefs.current.set(r.subscriptionId, el);
                  else rowRefs.current.delete(r.subscriptionId);
                }}
                className={`card-surface flex min-w-0 items-start gap-4 rounded-2xl p-4 transition-shadow ${
                  focusedId === r.subscriptionId
                    ? 'ring-2 ring-sensu-400'
                    : ''
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold tracking-tight text-zinc-900">
                    {r.fullName ?? r.email}
                  </p>
                  <p className="mt-1 break-all text-xs text-zinc-500">
                    <LuMail className="mr-1 inline h-3 w-3" />
                    {r.email}
                    {r.buyerPhone ? (
                      <>
                        {' · '}
                        <LuPhone className="mr-1 inline h-3 w-3" />
                        {r.buyerPhone}
                      </>
                    ) : null}
                  </p>
                  <p className="mt-1 break-words text-xs text-zinc-500">
                    <LuMapPin className="mr-1 inline h-3 w-3" />
                    {r.shippingAddress ?? r.homeAddress ?? '—'}
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-400">
                    {r.planName} · pago {formatDate(r.purchaseDate)}
                  </p>
                </div>
                <button
                  type="button"
                  data-testid={`dispatch-ship-row-${r.subscriptionId}-mark`}
                  onClick={() => setPendingShip(r)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-sensu-500 px-3 py-1.5 text-xs font-medium tracking-tight text-white transition-transform hover:-translate-y-0.5 active:scale-[0.98] cursor-pointer"
                >
                  Marcar enviado
                </button>
              </li>
            ))}
            </ul>
            <PaginationNav
              {...shippingPagination}
              testIdPrefix="dispatch-shipping-pagination"
              position="bottom"
            />
          </>
        )}
      </section>

      <section data-testid="dispatch-awaiting-activation">
        <h2 className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
          <LuRadio aria-hidden className="h-4 w-4 text-emerald-500" />
          Esperando activación · {activatingPagination.totalRows}
        </h2>
        {initialActivating.length === 0 ? (
          <p
            data-testid="dispatch-activation-empty"
            className="mt-4 rounded-3xl bg-white p-8 text-sm text-zinc-500 ring-1 ring-zinc-200"
          >
            No hay Angelas esperando activación. Cuando marques una como
            enviada, aparece aquí lista para vincular su IMEI.
          </p>
        ) : (
          <>
            <PaginationNav
              {...activatingPagination}
              testIdPrefix="dispatch-activation-pagination"
              position="top"
            />
            <ul className="mt-2 grid gap-3">
            {initialActivating.map((r) => (
              <li
                key={r.subscriptionId}
                data-testid={`dispatch-activate-row-${r.subscriptionId}`}
                data-focused={focusedId === r.subscriptionId ? 'true' : undefined}
                ref={(el) => {
                  if (el) rowRefs.current.set(r.subscriptionId, el);
                  else rowRefs.current.delete(r.subscriptionId);
                }}
                className={`card-surface flex min-w-0 items-start gap-4 rounded-2xl p-4 transition-shadow ${
                  focusedId === r.subscriptionId
                    ? 'ring-2 ring-sensu-400'
                    : ''
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold tracking-tight text-zinc-900">
                    {r.fullName ?? r.email}
                  </p>
                  <p className="mt-1 break-all text-xs text-zinc-500">
                    <LuMail className="mr-1 inline h-3 w-3" />
                    {r.email}
                    {r.buyerPhone ? (
                      <>
                        {' · '}
                        <LuPhone className="mr-1 inline h-3 w-3" />
                        {r.buyerPhone}
                      </>
                    ) : null}
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-400">
                    {r.planName} · enviado {formatDate(r.shippedAt)}
                  </p>
                </div>
                <button
                  type="button"
                  data-testid={`dispatch-activate-row-${r.subscriptionId}-pair`}
                  onClick={() => setPendingActivate(r)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-medium tracking-tight text-white transition-transform hover:-translate-y-0.5 active:scale-[0.98] cursor-pointer"
                >
                  Vincular IMEI
                </button>
              </li>
            ))}
            </ul>
            <PaginationNav
              {...activatingPagination}
              testIdPrefix="dispatch-activation-pagination"
              position="bottom"
            />
          </>
        )}
      </section>

      <ConfirmModal
        open={pendingShip !== null}
        title={`Marcar como enviado: ${pendingShip?.fullName ?? pendingShip?.email ?? ''}`}
        body={`Stampamos la fecha de envío y avisamos al titular por correo a ${pendingShip?.email ?? ''}.`}
        confirmLabel="Marcar enviado"
        busy={busy}
        onConfirm={() => void confirmShip()}
        onCancel={close}
        testId="dispatch-confirm-ship"
      />

      <Modal
        open={pendingActivate !== null}
        onClose={close}
        title={`Vincular IMEI · ${pendingActivate?.fullName ?? pendingActivate?.email ?? ''}`}
        testId="dispatch-activate-modal"
        size="sm"
      >
        {pendingActivate ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void confirmActivate();
            }}
            className="space-y-4"
          >
            <label className="block text-sm">
              <span className="block text-xs font-medium text-zinc-700">
                IMEI / device ID
              </span>
              <input
                type="text"
                required
                data-testid="dispatch-activate-imei"
                value={imei}
                onChange={(e) => setImei(e.target.value)}
                placeholder="861629052847401"
                autoComplete="off"
                spellCheck={false}
                className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 font-mono text-sm text-zinc-900 outline-none focus:border-sensu-400 focus:ring-2 focus:ring-sensu-200"
              />
              <span className="mt-1 block text-[11px] leading-snug text-zinc-500">
                15 dígitos en EV-04 / EV-12. Identificador de hardware del
                pendant.
              </span>
            </label>
            <label className="block text-sm">
              <span className="block text-xs font-medium text-zinc-700">
                Número telefónico del pendant{' '}
                <span className="text-zinc-400">(opcional)</span>
              </span>
              <input
                type="tel"
                data-testid="dispatch-activate-phone"
                value={devicePhone}
                onChange={(e) => setDevicePhone(e.target.value)}
                placeholder="+52 55 1234 5678"
                autoComplete="off"
                spellCheck={false}
                className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-sensu-400 focus:ring-2 focus:ring-sensu-200"
              />
              <span className="mt-1 block text-[11px] leading-snug text-zinc-500">
                SIM del pendant. El operador puede llamarlo desde la ficha del
                titular para hablar por la bocina del dispositivo.
              </span>
            </label>
            {error ? (
              <p
                data-testid="dispatch-activate-error"
                className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200"
              >
                {error}
              </p>
            ) : null}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                data-testid="dispatch-activate-cancel"
                onClick={close}
                disabled={busy}
                className="inline-flex items-center rounded-full bg-sky-50 px-4 py-2 text-sm font-medium tracking-tight text-sky-700 transition-colors hover:bg-sky-100 disabled:opacity-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                data-testid="dispatch-activate-submit"
                disabled={busy || imei.trim().length < 8}
                className="inline-flex items-center rounded-full bg-emerald-500 px-4 py-2 text-sm font-medium tracking-tight text-white transition-transform hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50 disabled:hover:translate-y-0 cursor-pointer"
              >
                {busy ? 'Vinculando…' : 'Vincular y activar'}
              </button>
            </div>
          </form>
        ) : null}
      </Modal>
    </div>
  );
}
