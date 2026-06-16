'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { LuArrowLeft, LuCircleAlert, LuMailCheck } from 'react-icons/lu';
import {
  requestPasswordResetAction,
  type RequestResetState,
} from '@/lib/actions/request-password-reset';

const initial: RequestResetState = { ok: false };

const fieldBase =
  'h-11 rounded-xl border border-zinc-200 bg-white px-4 text-zinc-900 transition-all duration-200 ease-[cubic-bezier(.32,.72,0,1)] placeholder:text-zinc-400 hover:border-zinc-300 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300/60';

const submitBase =
  'mt-1 inline-flex h-11 items-center justify-center rounded-full bg-sensu-500 px-6 text-sm font-medium tracking-tight text-white transition-transform duration-200 ease-[cubic-bezier(.32,.72,0,1)] hover:-translate-y-0.5 active:scale-[0.98] disabled:cursor-progress disabled:opacity-60 disabled:hover:translate-y-0 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sensu-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white';

export default function ForgotForm() {
  const [state, formAction, pending] = useActionState(
    requestPasswordResetAction,
    initial,
  );

  return (
    <main
      data-testid="forgot-password-page"
      className="min-h-screen flex items-center justify-center px-6 py-16"
    >
      <div className="card-surface w-full max-w-md rounded-3xl p-8 animate-rise">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 animate-fade-up [animation-delay:60ms]">
          Recuperar contraseña
        </h1>
        <p className="mt-2 text-sm text-zinc-500 animate-fade-up [animation-delay:120ms]">
          Te enviaremos un enlace por email para elegir una nueva contraseña.
        </p>

        {state.ok ? (
          <p
            role="status"
            data-testid="forgot-confirmation"
            className="mt-7 flex items-start gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200 animate-fade-in"
          >
            <LuMailCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            <span>
              Si esa dirección está registrada, te enviamos un enlace para
              recuperar tu contraseña. Revisa tu correo.
            </span>
          </p>
        ) : (
          <form
            action={formAction}
            aria-label="forgot-password-form"
            className="mt-7 flex flex-col gap-5"
          >
            <label className="flex flex-col gap-2 text-sm animate-fade-up [animation-delay:180ms]">
              <span className="text-zinc-600">Email</span>
              <input
                type="email"
                name="email"
                autoComplete="email"
                required
                className={fieldBase}
              />
            </label>
            {state.error && (
              <p
                role="alert"
                data-testid="forgot-error"
                className="flex items-start gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200 animate-fade-in"
              >
                <LuCircleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                {state.error}
              </p>
            )}
            <button
              type="submit"
              disabled={pending}
              className={`${submitBase} animate-fade-up [animation-delay:240ms]`}
            >
              {pending ? 'Enviando…' : 'Enviar enlace'}
            </button>
          </form>
        )}

        <div className="mt-6 flex flex-col gap-2 text-sm text-zinc-500 animate-fade-up [animation-delay:320ms]">
          <p>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-sensu-600 transition-colors hover:text-sensu-700"
            >
              <LuArrowLeft aria-hidden className="h-4 w-4" />
              Volver al inicio de sesión
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
