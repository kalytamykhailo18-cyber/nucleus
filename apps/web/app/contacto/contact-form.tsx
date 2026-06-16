'use client';

import { useState } from 'react';
import {
  LuCircleAlert,
  LuCircleCheck,
  LuMail,
  LuPhone,
  LuUser,
} from 'react-icons/lu';

const fieldBase =
  'h-11 rounded-xl border border-zinc-200 bg-white px-4 text-zinc-900 transition-all duration-200 ease-[cubic-bezier(.32,.72,0,1)] placeholder:text-zinc-400 hover:border-zinc-300 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300/60';

const submitBase =
  'mt-1 inline-flex h-11 items-center justify-center rounded-full bg-sensu-500 px-6 text-sm font-medium tracking-tight text-white transition-transform duration-200 ease-[cubic-bezier(.32,.72,0,1)] hover:-translate-y-0.5 active:scale-[0.98] disabled:cursor-progress disabled:opacity-60 disabled:hover:translate-y-0 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sensu-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white';

export function ContactForm(): React.ReactElement {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch('/api/contact-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, phone }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(
          body?.error === 'invalid'
            ? 'Revisa los datos del formulario.'
            : 'No pudimos enviar tu mensaje. Inténtalo de nuevo en un minuto.',
        );
        setPending(false);
        return;
      }
      setDone(true);
    } catch {
      setError('Error de red. Inténtalo de nuevo.');
      setPending(false);
    }
  }

  if (done) {
    return (
      <div
        data-testid="contact-form-success"
        className="card-surface mt-6 flex items-start gap-3 rounded-3xl bg-emerald-50 px-6 py-6 ring-1 ring-emerald-200"
      >
        <LuCircleCheck
          aria-hidden
          className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500"
        />
        <div>
          <p className="text-base font-medium text-emerald-900">
            Gracias, te contactamos pronto.
          </p>
          <p className="mt-1 text-sm text-emerald-800/80">
            Un miembro del equipo de ventas te llamará al teléfono que
            registraste durante el siguiente día hábil.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="contact-form"
      data-testid="contact-form"
      className="mt-7 flex flex-col gap-5"
    >
      <label className="flex flex-col gap-2 text-sm">
        <span className="flex items-center gap-1.5 text-zinc-600">
          <LuUser aria-hidden className="h-3.5 w-3.5 text-sensu-500" />
          Nombre completo
        </span>
        <input
          type="text"
          name="fullName"
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          minLength={2}
          maxLength={120}
          data-testid="contact-form-name"
          className={fieldBase}
        />
      </label>
      <label className="flex flex-col gap-2 text-sm">
        <span className="flex items-center gap-1.5 text-zinc-600">
          <LuMail aria-hidden className="h-3.5 w-3.5 text-sky-500" />
          Email
        </span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          maxLength={160}
          data-testid="contact-form-email"
          className={fieldBase}
        />
      </label>
      <label className="flex flex-col gap-2 text-sm">
        <span className="flex items-center gap-1.5 text-zinc-600">
          <LuPhone aria-hidden className="h-3.5 w-3.5 text-emerald-500" />
          Teléfono
        </span>
        <input
          type="tel"
          name="phone"
          autoComplete="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          minLength={7}
          maxLength={40}
          placeholder="+52 55 1234 5678"
          data-testid="contact-form-phone"
          className={fieldBase}
        />
      </label>

      {error && (
        <p
          role="alert"
          data-testid="contact-form-error"
          className="flex items-start gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200"
        >
          <LuCircleAlert
            aria-hidden
            className="mt-0.5 h-4 w-4 shrink-0 text-rose-500"
          />
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        data-testid="contact-form-submit"
        className={submitBase}
      >
        {pending ? 'Enviando…' : 'Enviar'}
      </button>
    </form>
  );
}
