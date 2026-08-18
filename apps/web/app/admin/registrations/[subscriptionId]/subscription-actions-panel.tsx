'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  LuBanknote,
  LuPause,
  LuPlay,
  LuShuffle,
  LuTriangleAlert,
} from 'react-icons/lu';
import { Modal } from '@/components/modal';

/**
 * Self-serve subscription admin (Juan 2026-06-18) — four operator
 * actions that previously required a hop into the Stripe dashboard:
 *
 *   - Refund (Stripe refund of a specific PaymentIntent, full or partial)
 *   - Pause (status ACTIVE → PAUSED — renewal worker skips PAUSED rows)
 *   - Resume (PAUSED → ACTIVE — next renewal cycle resumes)
 *   - Change plan (planType and/or cadence for the NEXT renewal)
 *
 * Every action requires a typed reason that lands on the
 * AdminAuditLog row so the call-center has to justify each move and
 * we can answer "who refunded what, when, why" on the audit board.
 *
 * Buttons are disabled when they don't apply: Refund only when
 * there's a succeeded PaymentIntent, Pause only on ACTIVE, Resume
 * only on PAUSED, Change plan never on CANCELLED.
 */

type ActionKind = 'refund' | 'pause' | 'resume' | 'change-plan';

export interface SubscriptionActionPaymentRow {
  id: string;
  amountCentavos: number;
  status: string;
  refundedCentavos: number;
  createdAt: string;
}

interface Props {
  subscriptionId: string;
  status: string;
  planType: string;
  cadence: 'MONTHLY' | 'SEMESTRAL' | 'ANNUAL' | null;
  payments: SubscriptionActionPaymentRow[] | null;
}

function pesos(centavos: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(centavos / 100);
}

export function SubscriptionActionsPanel({
  subscriptionId,
  status,
  planType,
  cadence,
  payments,
}: Props): React.ReactElement {
  const router = useRouter();
  const [open, setOpen] = useState<ActionKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refundCandidate = (payments ?? []).find(
    (p) =>
      p.status === 'succeeded' && p.refundedCentavos < p.amountCentavos,
  );

  const canRefund = !!refundCandidate;
  const canPause = status === 'ACTIVE';
  const canResume = status === 'PAUSED';
  const canChangePlan = status !== 'CANCELLED';

  function closeAll(): void {
    setOpen(null);
    setBusy(false);
    setError(null);
  }

  async function submit(path: string, body: Record<string, unknown>): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/subscriptions/${subscriptionId}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? body.error ?? `HTTP ${res.status}`);
      }
      closeAll();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <section
      data-testid="admin-subscription-actions"
      className="card-surface mt-8 rounded-3xl p-6"
    >
      <h2 className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
        <LuTriangleAlert aria-hidden className="h-3.5 w-3.5 text-amber-500" />
        Acciones del operador
      </h2>
      <p className="mt-2 text-sm text-zinc-500">
        Estas acciones se ejecutan dentro de Nucleus, sin abrir Stripe.
        Cada una requiere una razón que queda en el registro de auditoría.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <ActionButton
          icon={LuBanknote}
          label="Reembolsar pago"
          help={
            canRefund && refundCandidate
              ? `Último pago: ${pesos(refundCandidate.amountCentavos)} · ${refundCandidate.id.slice(0, 14)}…`
              : 'No hay pagos elegibles para reembolso.'
          }
          disabled={!canRefund}
          tone="rose"
          testId="admin-subscription-action-refund"
          onClick={() => setOpen('refund')}
        />
        <ActionButton
          icon={LuPause}
          label="Pausar suscripción"
          help={
            canPause
              ? 'Detiene el siguiente cobro hasta que la reanudes.'
              : `Solo disponible cuando el estado es ACTIVE (actual: ${status}).`
          }
          disabled={!canPause}
          tone="amber"
          testId="admin-subscription-action-pause"
          onClick={() => setOpen('pause')}
        />
        <ActionButton
          icon={LuPlay}
          label="Reanudar suscripción"
          help={
            canResume
              ? 'Reactiva el cobro en el próximo ciclo de renovación.'
              : `Solo disponible cuando el estado es PAUSED (actual: ${status}).`
          }
          disabled={!canResume}
          tone="emerald"
          testId="admin-subscription-action-resume"
          onClick={() => setOpen('resume')}
        />
        <ActionButton
          icon={LuShuffle}
          label="Cambiar plan o cadencia"
          help={
            canChangePlan
              ? `Actual: ${planType} · ${cadence ?? 'sin cadencia'}.`
              : 'No se puede cambiar el plan de una suscripción CANCELLED.'
          }
          disabled={!canChangePlan}
          tone="sensu"
          testId="admin-subscription-action-change-plan"
          onClick={() => setOpen('change-plan')}
        />
      </div>

      {open === 'refund' && refundCandidate && (
        <RefundModal
          payment={refundCandidate}
          busy={busy}
          error={error}
          onCancel={closeAll}
          onSubmit={(amount, reason) =>
            submit('refund', {
              paymentIntentId: refundCandidate.id,
              amountCentavos: amount,
              reason,
            })
          }
        />
      )}
      {open === 'pause' && (
        <ReasonModal
          title="Pausar suscripción"
          confirmLabel="Pausar"
          tone="amber"
          busy={busy}
          error={error}
          onCancel={closeAll}
          onSubmit={(reason) => submit('pause', { reason })}
        />
      )}
      {open === 'resume' && (
        <ReasonModal
          title="Reanudar suscripción"
          confirmLabel="Reanudar"
          tone="emerald"
          busy={busy}
          error={error}
          reasonOptional
          onCancel={closeAll}
          onSubmit={(reason) =>
            submit('resume', reason ? { reason } : {})
          }
        />
      )}
      {open === 'change-plan' && (
        <ChangePlanModal
          currentPlanType={planType}
          currentCadence={cadence}
          busy={busy}
          error={error}
          onCancel={closeAll}
          onSubmit={(payload) => submit('change-plan', payload)}
        />
      )}
    </section>
  );
}

function ActionButton({
  icon: Icon,
  label,
  help,
  disabled,
  tone,
  testId,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  label: string;
  help: string;
  disabled: boolean;
  tone: 'rose' | 'amber' | 'emerald' | 'sensu';
  testId: string;
  onClick: () => void;
}): React.ReactElement {
  const toneClasses: Record<typeof tone, string> = {
    rose: 'text-rose-700 ring-rose-200 hover:bg-rose-50',
    amber: 'text-amber-700 ring-amber-200 hover:bg-amber-50',
    emerald: 'text-emerald-700 ring-emerald-200 hover:bg-emerald-50',
    sensu: 'text-sensu-700 ring-sensu-200 hover:bg-sensu-50',
  };
  return (
    <button
      type="button"
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      className={`flex flex-col items-start gap-1 rounded-2xl bg-white p-4 text-left ring-1 ring-inset cursor-pointer transition-colors disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white ${toneClasses[tone]}`}
    >
      <span className="inline-flex items-center gap-2 text-sm font-medium">
        <Icon aria-hidden className="h-4 w-4" />
        {label}
      </span>
      <span className="text-xs text-zinc-500">{help}</span>
    </button>
  );
}

function RefundModal({
  payment,
  busy,
  error,
  onCancel,
  onSubmit,
}: {
  payment: SubscriptionActionPaymentRow;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (amount: number | undefined, reason: string) => void;
}): React.ReactElement {
  const max = payment.amountCentavos - payment.refundedCentavos;
  const [pesosInput, setPesosInput] = useState((max / 100).toFixed(0));
  const [reason, setReason] = useState('');
  const [partial, setPartial] = useState(false);

  function handleSubmit(): void {
    const amount = partial
      ? Math.round(parseFloat(pesosInput) * 100)
      : undefined;
    onSubmit(amount, reason);
  }

  return (
    <Modal
      open
      onClose={onCancel}
      title="Reembolsar pago"
      testId="admin-subscription-refund-modal"
      size="sm"
      cardClassName="ring-2 ring-rose-300"
    >
      <p className="text-sm text-zinc-600">
        Reembolsará el pago <span className="font-mono">{payment.id.slice(0, 18)}…</span>.
        Stripe puede tardar varios días hábiles en devolver el dinero a la tarjeta del cliente.
      </p>
      <div className="mt-4 space-y-3 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={!partial}
            onChange={() => setPartial(false)}
            data-testid="admin-subscription-refund-full"
          />
          Reembolso total ({pesos(max)})
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={partial}
            onChange={() => setPartial(true)}
            data-testid="admin-subscription-refund-partial"
          />
          Reembolso parcial
        </label>
        {partial && (
          <div className="ml-6 flex items-center gap-2">
            <span className="text-zinc-500">$</span>
            <input
              type="number"
              min={1}
              max={max / 100}
              value={pesosInput}
              onChange={(e) => setPesosInput(e.target.value)}
              data-testid="admin-subscription-refund-amount"
              className="w-32 rounded-md border border-zinc-300 px-2 py-1 text-sm tabular-nums"
            />
            <span className="text-zinc-500">MXN</span>
          </div>
        )}
        <div>
          <label className="block text-xs text-zinc-500">Razón (obligatoria)</label>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            data-testid="admin-subscription-refund-reason"
            placeholder="Por ejemplo: cliente reportó cobro duplicado, conversación 2026-06-18"
            className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1 text-sm"
            required
          />
        </div>
        {error && (
          <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-200">
            {error}
          </p>
        )}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-full px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 cursor-pointer"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={busy || reason.trim().length === 0}
          data-testid="admin-subscription-refund-confirm"
          className="rounded-full bg-rose-500 px-4 py-2 text-sm font-medium text-white hover:bg-rose-600 disabled:opacity-50 cursor-pointer"
        >
          {busy ? 'Reembolsando…' : 'Reembolsar'}
        </button>
      </div>
    </Modal>
  );
}

function ReasonModal({
  title,
  confirmLabel,
  tone,
  busy,
  error,
  reasonOptional,
  onCancel,
  onSubmit,
}: {
  title: string;
  confirmLabel: string;
  tone: 'amber' | 'emerald';
  busy: boolean;
  error: string | null;
  reasonOptional?: boolean;
  onCancel: () => void;
  onSubmit: (reason: string) => void;
}): React.ReactElement {
  const [reason, setReason] = useState('');
  const ringClass = tone === 'amber' ? 'ring-2 ring-amber-300' : 'ring-2 ring-emerald-300';
  const buttonClass =
    tone === 'amber'
      ? 'bg-amber-500 hover:bg-amber-600'
      : 'bg-emerald-500 hover:bg-emerald-600';
  return (
    <Modal
      open
      onClose={onCancel}
      title={title}
      testId={`admin-subscription-${title.toLowerCase().replace(/\s/g, '-')}-modal`}
      size="sm"
      cardClassName={ringClass}
    >
      <div>
        <label className="block text-xs text-zinc-500">
          Razón{reasonOptional ? ' (opcional)' : ' (obligatoria)'}
        </label>
        <textarea
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          data-testid="admin-subscription-reason"
          className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1 text-sm"
        />
      </div>
      {error && (
        <p className="mt-2 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-200">
          {error}
        </p>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-full px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 cursor-pointer"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => onSubmit(reason)}
          disabled={busy || (!reasonOptional && reason.trim().length === 0)}
          data-testid="admin-subscription-confirm"
          className={`rounded-full px-4 py-2 text-sm font-medium text-white disabled:opacity-50 cursor-pointer ${buttonClass}`}
        >
          {busy ? `${confirmLabel}…` : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

function ChangePlanModal({
  currentPlanType,
  currentCadence,
  busy,
  error,
  onCancel,
  onSubmit,
}: {
  currentPlanType: string;
  currentCadence: 'MONTHLY' | 'SEMESTRAL' | 'ANNUAL' | null;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (body: {
    planType?: 'ANGELA_ESENCIAL' | 'ANGELA_TOTAL';
    cadence?: 'MONTHLY' | 'SEMESTRAL' | 'ANNUAL';
    reason: string;
  }) => void;
}): React.ReactElement {
  const [planType, setPlanType] = useState<'ANGELA_ESENCIAL' | 'ANGELA_TOTAL'>(
    currentPlanType === 'ANGELA_TOTAL' ? 'ANGELA_TOTAL' : 'ANGELA_ESENCIAL',
  );
  const [cadence, setCadence] = useState<'MONTHLY' | 'SEMESTRAL' | 'ANNUAL'>(
    currentCadence ?? 'MONTHLY',
  );
  const [reason, setReason] = useState('');

  const noChange =
    planType === currentPlanType && cadence === currentCadence;

  function handleSubmit(): void {
    const body: {
      planType?: 'ANGELA_ESENCIAL' | 'ANGELA_TOTAL';
      cadence?: 'MONTHLY' | 'SEMESTRAL' | 'ANNUAL';
      reason: string;
    } = { reason };
    if (planType !== currentPlanType) body.planType = planType;
    if (cadence !== currentCadence) body.cadence = cadence;
    onSubmit(body);
  }

  return (
    <Modal
      open
      onClose={onCancel}
      title="Cambiar plan o cadencia"
      testId="admin-subscription-change-plan-modal"
      size="sm"
      cardClassName="ring-2 ring-sensu-300"
    >
      <p className="text-sm text-zinc-600">
        El cambio aplica desde la próxima renovación. El ciclo actual no se modifica.
      </p>
      <div className="mt-4 space-y-3 text-sm">
        <div>
          <label className="block text-xs text-zinc-500">Plan</label>
          <select
            value={planType}
            onChange={(e) =>
              setPlanType(e.target.value as 'ANGELA_ESENCIAL' | 'ANGELA_TOTAL')
            }
            data-testid="admin-subscription-change-plan-type"
            className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1 text-sm"
          >
            <option value="ANGELA_ESENCIAL">Angela Esencial</option>
            <option value="ANGELA_TOTAL">Angela Total</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-zinc-500">Cadencia</label>
          <select
            value={cadence}
            onChange={(e) =>
              setCadence(e.target.value as 'MONTHLY' | 'SEMESTRAL' | 'ANNUAL')
            }
            data-testid="admin-subscription-change-plan-cadence"
            className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1 text-sm"
          >
            <option value="MONTHLY">Mensual</option>
            <option value="SEMESTRAL">Semestral</option>
            <option value="ANNUAL">Anual</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-zinc-500">Razón (obligatoria)</label>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            data-testid="admin-subscription-change-plan-reason"
            className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1 text-sm"
          />
        </div>
        {error && (
          <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-200">
            {error}
          </p>
        )}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-full px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 cursor-pointer"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={busy || noChange || reason.trim().length === 0}
          data-testid="admin-subscription-change-plan-confirm"
          className="rounded-full bg-sensu-500 px-4 py-2 text-sm font-medium text-white hover:bg-sensu-600 disabled:opacity-50 cursor-pointer"
        >
          {busy ? 'Aplicando…' : 'Aplicar cambio'}
        </button>
      </div>
    </Modal>
  );
}
