'use client';

import { useState } from 'react';
import { LuClipboardCopy, LuCheck, LuTriangleAlert } from 'react-icons/lu';

interface Result {
  paymentLinkId: string;
  paymentLinkUrl: string;
}

export function AssistedSalesForm(): React.ReactElement {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  // Plan dropdown intentionally locked to Esencial today (Juan
  // 2026-06-22: "now we are only offering Esencial"). Reinstating Total
  // is a one-line revert when the second tier reopens for sale.
  const [planType] = useState<'ANGELA_ESENCIAL'>('ANGELA_ESENCIAL');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    setCopied(false);
    try {
      const res = await fetch('/api/admin/assisted-sales/create-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, phone, email, planType }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
          error?: string;
        };
        setError(
          body.message ?? body.error ?? 'No se pudo generar el enlace.',
        );
        return;
      }
      const body = (await res.json()) as Result;
      setResult(body);
    } finally {
      setBusy(false);
    }
  }

  async function copyLink(): Promise<void> {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.paymentLinkUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('No pudimos copiar al portapapeles. Selecciona y copia manualmente.');
    }
  }

  return (
    <form
      onSubmit={submit}
      data-testid="assisted-sales-form"
      className="card-surface mt-6 rounded-3xl p-6"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs uppercase tracking-[0.14em] text-zinc-500">
            Nombre completo
          </span>
          <input
            data-testid="assisted-sales-fullname"
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="mt-2 h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm focus:border-sensu-500 focus:outline-none"
            placeholder="María González Pérez"
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-[0.14em] text-zinc-500">
            Teléfono
          </span>
          <input
            data-testid="assisted-sales-phone"
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-2 h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm focus:border-sensu-500 focus:outline-none"
            placeholder="+52 55 1234 5678"
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-[0.14em] text-zinc-500">
            Correo electrónico
          </span>
          <input
            data-testid="assisted-sales-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm focus:border-sensu-500 focus:outline-none"
            placeholder="cliente@correo.com"
          />
        </label>
        <div className="block">
          <span className="text-xs uppercase tracking-[0.14em] text-zinc-500">
            Plan
          </span>
          <div
            data-testid="assisted-sales-plan"
            className="mt-2 inline-flex h-11 items-center rounded-xl bg-zinc-100 px-4 text-sm text-zinc-900 ring-1 ring-zinc-200"
          >
            Esencial
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={busy}
        data-testid="assisted-sales-submit"
        className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-sensu-500 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 hover:bg-sensu-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
      >
        {busy ? 'Generando…' : 'Generar enlace'}
      </button>

      {error && (
        <p
          data-testid="assisted-sales-error"
          className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-200"
        >
          <LuTriangleAlert aria-hidden className="h-4 w-4" />
          {error}
        </p>
      )}

      {result && (
        <div
          data-testid="assisted-sales-result"
          className="mt-6 rounded-2xl bg-emerald-50 px-4 py-4 ring-1 ring-emerald-200"
        >
          <p className="text-xs uppercase tracking-[0.14em] text-emerald-700">
            Enlace listo
          </p>
          <p
            data-testid="assisted-sales-result-url"
            className="mt-2 break-all font-mono text-xs text-emerald-900"
          >
            {result.paymentLinkUrl}
          </p>
          <button
            type="button"
            onClick={copyLink}
            data-testid="assisted-sales-copy"
            className="mt-3 inline-flex h-9 items-center gap-2 rounded-full bg-emerald-700 px-4 text-xs font-medium text-white transition-transform hover:-translate-y-0.5 hover:bg-emerald-800 active:scale-[0.98] cursor-pointer"
          >
            {copied ? (
              <>
                <LuCheck aria-hidden className="h-3.5 w-3.5" /> Copiado
              </>
            ) : (
              <>
                <LuClipboardCopy aria-hidden className="h-3.5 w-3.5" /> Copiar enlace
              </>
            )}
          </button>
        </div>
      )}
    </form>
  );
}
