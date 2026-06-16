'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  LuArrowRight,
  LuCircleAlert,
  LuCircleCheck,
  LuEye,
  LuEyeOff,
} from 'react-icons/lu';
import {
  resetPasswordAction,
  type ResetPasswordState,
} from '@/lib/actions/reset-password';

const initial: ResetPasswordState = { ok: false };

const fieldBase =
  'h-11 rounded-xl border border-zinc-200 bg-white px-4 text-zinc-900 transition-all duration-200 ease-[cubic-bezier(.32,.72,0,1)] placeholder:text-zinc-400 hover:border-zinc-300 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300/60';

const submitBase =
  'mt-1 inline-flex h-11 items-center justify-center rounded-full bg-sensu-500 px-6 text-sm font-medium tracking-tight text-white transition-transform duration-200 ease-[cubic-bezier(.32,.72,0,1)] hover:-translate-y-0.5 active:scale-[0.98] disabled:cursor-progress disabled:opacity-60 disabled:hover:translate-y-0 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sensu-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white';

export default function ResetForm() {
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [state, formAction, pending] = useActionState(
    resetPasswordAction,
    initial,
  );
  const [reveal, setReveal] = useState(false);

  if (!token) {
    return (
      <main
        data-testid="reset-password-page"
        className="min-h-screen flex items-center justify-center px-6 py-16"
      >
        <div className="card-surface w-full max-w-md rounded-3xl p-8 animate-rise">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Enlace inválido
          </h1>
          <p
            role="alert"
            data-testid="reset-error"
            className="mt-4 flex items-start gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200"
          >
            <LuCircleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
            El enlace no es válido. Solicita uno nuevo.
          </p>
          <p className="mt-6 text-sm">
            <Link
              href="/forgot-password"
              className="inline-flex items-center gap-1.5 text-sensu-600 transition-colors hover:text-sensu-700"
            >
              Solicitar otro enlace
              <LuArrowRight aria-hidden className="h-4 w-4" />
            </Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main
      data-testid="reset-password-page"
      className="min-h-screen flex items-center justify-center px-6 py-16"
    >
      <div className="card-surface w-full max-w-md rounded-3xl p-8 animate-rise">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 animate-fade-up [animation-delay:60ms]">
          Nueva contraseña
        </h1>

        {state.ok ? (
          <>
            <p
              role="status"
              data-testid="reset-success"
              className="mt-7 flex items-start gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200 animate-fade-in"
            >
              <LuCircleCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              Contraseña actualizada. Ya puedes iniciar sesión con la nueva.
            </p>
            <p className="mt-6 text-sm">
              <Link
                href="/login"
                data-testid="reset-success-login-link"
                className="inline-flex items-center gap-1.5 text-sensu-600 transition-colors hover:text-sensu-700"
              >
                Ir a iniciar sesión
                <LuArrowRight aria-hidden className="h-4 w-4" />
              </Link>
            </p>
          </>
        ) : (
          <form
            action={formAction}
            aria-label="reset-password-form"
            className="mt-7 flex flex-col gap-5"
          >
            <input type="hidden" name="token" value={token} />
            <label className="flex flex-col gap-2 text-sm animate-fade-up [animation-delay:120ms]">
              <span className="text-zinc-600">
                Nueva contraseña (mínimo 8 caracteres)
              </span>
              <span className="relative block">
                <input
                  type={reveal ? 'text' : 'password'}
                  name="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  className={`${fieldBase} w-full pr-12`}
                />
                <button
                  type="button"
                  data-testid="reset-password-toggle"
                  aria-label={reveal ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-pressed={reveal}
                  onClick={() => setReveal((r) => !r)}
                  className="absolute inset-y-0 right-2 inline-flex items-center justify-center rounded-full px-2 text-sky-500 transition-colors hover:bg-sky-50 hover:text-sky-700"
                >
                  {reveal ? (
                    <LuEyeOff aria-hidden className="h-4 w-4 text-sky-500" />
                  ) : (
                    <LuEye aria-hidden className="h-4 w-4 text-sky-500" />
                  )}
                </button>
              </span>
            </label>
            {state.error && (
              <p
                role="alert"
                data-testid="reset-error"
                className="flex items-start gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200 animate-fade-in"
              >
                <LuCircleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                {state.error}
              </p>
            )}
            <button
              type="submit"
              disabled={pending}
              className={`${submitBase} animate-fade-up [animation-delay:180ms]`}
            >
              {pending ? 'Guardando…' : 'Guardar contraseña'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
