'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LuSparkles, LuX, LuTriangleAlert } from 'react-icons/lu';

/**
 * "Crear demo" button for /admin/registrations (Juan 2026-06-22).
 * Opens a small modal asking for the demo lead's email, full name,
 * and plan. Submitting hits /api/admin/demo-accounts/create which
 * mints (or reuses) the User and adds a $0 ACTIVE Subscription so
 * the new row shows up in the registrations table immediately, with
 * the standard Asignar IMEI link the admin already uses.
 */
type PaymentMode = 'demo' | 'transfer';

export function CrearDemoButton(): React.ReactElement {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [planType, setPlanType] = useState<'ANGELA_ESENCIAL' | 'ANGELA_TOTAL'>(
    'ANGELA_ESENCIAL',
  );
  // Juan 2026-06-25: same button now handles both free demos and
  // bank-transfer-paid accounts. Transfer mode reveals the amount +
  // reference fields and sends the payment metadata to the API; demo
  // mode keeps the old $0 shape.
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('demo');
  const [amountMxn, setAmountMxn] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm(): void {
    setEmail('');
    setFullName('');
    setPaymentMode('demo');
    setAmountMxn('');
    setPaymentReference('');
  }

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        email,
        fullName,
        planType,
        paymentMode,
      };
      if (paymentMode === 'transfer') {
        const pesos = Number(amountMxn);
        if (!Number.isFinite(pesos) || pesos <= 0) {
          setError('Indica el monto transferido en pesos.');
          setBusy(false);
          return;
        }
        payload.amountPaidCentavos = Math.round(pesos * 100);
        if (paymentReference.trim().length > 0) {
          payload.paymentReference = paymentReference.trim();
        }
      }
      const res = await fetch('/api/admin/demo-accounts/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
          error?: string;
        };
        setError(body.message ?? body.error ?? 'No se pudo crear la cuenta.');
        return;
      }
      setOpen(false);
      resetForm();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        data-testid="admin-crear-demo"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center gap-2 rounded-full bg-zinc-900 px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 hover:bg-zinc-800 active:scale-[0.98] cursor-pointer"
      >
        <LuSparkles aria-hidden className="h-4 w-4" />
        Crear demo
      </button>

      {open && (
        <div
          data-testid="admin-crear-demo-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 px-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <form
            onSubmit={submit}
            className="card-surface w-full max-w-lg rounded-3xl p-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
                {paymentMode === 'transfer'
                  ? 'Crear cuenta por transferencia'
                  : 'Crear cuenta demo'}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="rounded-full p-1 text-zinc-500 hover:bg-zinc-100 cursor-pointer"
              >
                <LuX aria-hidden className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              {paymentMode === 'transfer'
                ? 'El cliente ya pagó por transferencia. Capturamos el monto y le mandamos el correo para que entre y complete el cuestionario.'
                : 'Crea una cuenta y suscripción de demostración sin cobro. Después puedes asignarle un dispositivo desde la tabla.'}
            </p>

            {/* Payment-mode picker (Juan 2026-06-25). Demo = $0 free
                trial. Transferencia = customer paid offline, captures
                amount + bank reference. */}
            <div
              role="radiogroup"
              aria-label="Tipo de pago"
              className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-zinc-100 p-1"
            >
              {(
                [
                  { value: 'demo', label: 'Demostración (sin cobro)' },
                  { value: 'transfer', label: 'Pagado por transferencia' },
                ] as Array<{ value: PaymentMode; label: string }>
              ).map((opt) => {
                const active = paymentMode === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    data-testid={`admin-crear-demo-mode-${opt.value}`}
                    onClick={() => setPaymentMode(opt.value)}
                    className={`inline-flex h-10 items-center justify-center rounded-xl px-3 text-xs font-medium transition-colors cursor-pointer ${
                      active
                        ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200'
                        : 'text-zinc-600 hover:bg-white/60'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                  Nombre completo
                </span>
                <input
                  data-testid="admin-crear-demo-fullname"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-2 h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm focus:border-sensu-500 focus:outline-none"
                  placeholder="Cliente Demo"
                />
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                  Correo electrónico
                </span>
                <input
                  data-testid="admin-crear-demo-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-2 h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm focus:border-sensu-500 focus:outline-none"
                  placeholder="cliente@correo.com"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                  Plan
                </span>
                <select
                  data-testid="admin-crear-demo-plan"
                  value={planType}
                  onChange={(e) =>
                    setPlanType(
                      e.target.value as 'ANGELA_ESENCIAL' | 'ANGELA_TOTAL',
                    )
                  }
                  className="mt-2 h-11 w-full cursor-pointer rounded-xl border border-zinc-200 bg-white px-3 text-sm focus:border-sensu-500 focus:outline-none"
                >
                  <option value="ANGELA_ESENCIAL">Esencial</option>
                  <option value="ANGELA_TOTAL">Total</option>
                </select>
              </label>
              {paymentMode === 'transfer' && (
                <>
                  <label className="block">
                    <span className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                      Monto recibido (MXN)
                    </span>
                    <input
                      data-testid="admin-crear-demo-amount"
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      value={amountMxn}
                      onChange={(e) => setAmountMxn(e.target.value)}
                      className="mt-2 h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm focus:border-sensu-500 focus:outline-none"
                      placeholder="9512.00"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                      Referencia bancaria (opcional)
                    </span>
                    <input
                      data-testid="admin-crear-demo-reference"
                      type="text"
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      maxLength={120}
                      className="mt-2 h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm focus:border-sensu-500 focus:outline-none"
                      placeholder="SPEI-20260625-0001"
                    />
                  </label>
                </>
              )}
            </div>

            {error && (
              <p
                data-testid="admin-crear-demo-error"
                className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-200"
              >
                <LuTriangleAlert aria-hidden className="h-4 w-4" />
                {error}
              </p>
            )}

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-10 items-center rounded-full px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={busy}
                data-testid="admin-crear-demo-submit"
                className="inline-flex h-10 items-center gap-2 rounded-full bg-zinc-900 px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 hover:bg-zinc-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
              >
                {busy
                  ? 'Creando…'
                  : paymentMode === 'transfer'
                    ? 'Crear cuenta'
                    : 'Crear demo'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
