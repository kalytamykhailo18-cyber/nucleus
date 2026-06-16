'use client';

import { useActionState, useEffect, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { LuCircleAlert, LuEye, LuEyeOff } from 'react-icons/lu';
import { signupAction, type SignupFormState } from '@/lib/actions/signup';

const initialState: SignupFormState = { ok: false };

const fieldBase =
  'h-11 rounded-xl border border-zinc-200 bg-white px-4 text-zinc-900 transition-all duration-200 ease-[cubic-bezier(.32,.72,0,1)] placeholder:text-zinc-400 hover:border-zinc-300 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300/60';

const submitBase =
  'mt-1 inline-flex h-11 items-center justify-center rounded-full bg-sensu-500 px-6 text-sm font-medium tracking-tight text-white transition-transform duration-200 ease-[cubic-bezier(.32,.72,0,1)] hover:-translate-y-0.5 active:scale-[0.98] disabled:cursor-progress disabled:opacity-60 disabled:hover:translate-y-0 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sensu-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white';

export default function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') ?? '/dashboard';
  const source = params.get('source') ?? '';

  const [state, formAction, pending] = useActionState(signupAction, initialState);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [autoSignInError, setAutoSignInError] = useState<string | null>(null);

  useEffect(() => {
    if (!state.ok) return;
    let cancelled = false;
    (async () => {
      const result = await signIn('credentials', { email, password, redirect: false });
      if (cancelled) return;
      if (!result || result.error) {
        setAutoSignInError(
          'Cuenta creada, pero no pudimos iniciar sesión automáticamente. Intenta entrar manualmente.',
        );
        return;
      }
      router.replace(next);
      router.refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [state.ok, email, password, next, router]);

  return (
    <main
      data-testid="signup-page"
      className="min-h-screen flex items-center justify-center px-6 py-16"
    >
      <div className="card-surface w-full max-w-md rounded-3xl p-8 animate-rise">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 animate-fade-up [animation-delay:60ms]">
          Crear cuenta
        </h1>
        <p className="mt-2 text-sm text-zinc-500 animate-fade-up [animation-delay:120ms]">
          Acceso al panel familiar y al historial de alertas en segundos.
        </p>

        <form
          action={formAction}
          aria-label="signup-form"
          className="mt-7 flex flex-col gap-5"
        >
          <input type="hidden" name="source" value={source} />
          <label className="flex flex-col gap-2 text-sm animate-fade-up [animation-delay:180ms]">
            <span className="text-zinc-600">Nombre completo</span>
            <input
              type="text"
              name="fullName"
              autoComplete="name"
              className={fieldBase}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm animate-fade-up [animation-delay:240ms]">
            <span className="text-zinc-600">Email</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={fieldBase}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm animate-fade-up [animation-delay:300ms]">
            <span className="text-zinc-600">Contraseña (mínimo 8 caracteres)</span>
            <span className="relative block">
              <input
                type={reveal ? 'text' : 'password'}
                name="password"
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={`${fieldBase} w-full pr-12`}
              />
              <button
                type="button"
                data-testid="signup-password-toggle"
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
              data-testid="signup-error"
              className="flex items-start gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200 animate-fade-in"
            >
              <LuCircleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
              {state.error}
            </p>
          )}
          {autoSignInError && (
            <p
              role="alert"
              data-testid="signup-error"
              className="flex items-start gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200 animate-fade-in"
            >
              <LuCircleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
              {autoSignInError}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className={`${submitBase} animate-fade-up [animation-delay:360ms]`}
          >
            {pending ? 'Creando cuenta…' : 'Crear cuenta'}
          </button>
        </form>

        <div className="mt-6 flex flex-col gap-2 text-sm text-zinc-500 animate-fade-up [animation-delay:440ms]">
          <p>
            ¿Ya tienes cuenta?{' '}
            <Link
              href={`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`}
              className="text-sensu-600 transition-colors hover:text-sensu-700"
            >
              Iniciar sesión
            </Link>
          </p>
          <p>
            ¿Eres familiar de un usuario Sensu?{' '}
            <Link
              href="/signup/familiar"
              data-testid="signup-family-link"
              className="text-sensu-600 transition-colors hover:text-sensu-700"
            >
              Únete como observador
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
