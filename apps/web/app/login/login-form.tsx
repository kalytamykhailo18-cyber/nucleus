'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  LuCircleAlert,
  LuCircleCheck,
  LuEye,
  LuEyeOff,
  LuKeyRound,
  LuRadio,
  LuUsers,
} from 'react-icons/lu';

const fieldBase =
  'h-11 rounded-xl border border-zinc-200 bg-white px-4 text-zinc-900 transition-all duration-200 ease-[cubic-bezier(.32,.72,0,1)] placeholder:text-zinc-400 hover:border-zinc-300 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300/60';

const submitBase =
  'mt-1 inline-flex h-11 items-center justify-center rounded-full bg-sensu-500 px-6 text-sm font-medium tracking-tight text-white transition-transform duration-200 ease-[cubic-bezier(.32,.72,0,1)] hover:-translate-y-0.5 active:scale-[0.98] disabled:cursor-progress disabled:opacity-60 disabled:hover:translate-y-0 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sensu-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white';

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next');
  const justLoggedOut = params.get('signed-out') === '1';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });
    setPending(false);
    if (!result || result.error) {
      setError('Email o contraseña incorrectos');
      return;
    }
    // Role-aware landing — admins go to `/` for the inline CMS, company
    // admins go to `/company`, everyone else lands on `/dashboard`. An
    // explicit ?next= wins so deep-link redirects still work.
    let destination = next;
    if (!destination) {
      try {
        const res = await fetch('/api/auth/post-login-destination', {
          cache: 'no-store',
        });
        const body = (await res.json()) as { url?: string };
        destination = body.url ?? '/dashboard';
      } catch {
        destination = '/dashboard';
      }
    }
    router.replace(destination);
    router.refresh();
  }

  return (
    <main
      data-testid="login-page"
      className="min-h-screen flex items-center justify-center px-6 py-16"
    >
      <div className="card-surface w-full max-w-md rounded-3xl p-8 animate-rise">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 animate-fade-up [animation-delay:60ms]">
          Iniciar sesión
        </h1>

        {justLoggedOut && (
          <p
            role="status"
            data-testid="logged-out-notice"
            className="mt-5 flex items-start gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200 animate-fade-in"
          >
            <LuCircleCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            Sesión cerrada correctamente.
          </p>
        )}

        <form
          onSubmit={handleSubmit}
          aria-label="login-form"
          className="mt-7 flex flex-col gap-5"
        >
          <label className="flex flex-col gap-2 text-sm animate-fade-up [animation-delay:120ms]">
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
          <label className="flex flex-col gap-2 text-sm animate-fade-up [animation-delay:180ms]">
            <span className="text-zinc-600">Contraseña</span>
            <span className="relative block">
              <input
                type={reveal ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={`${fieldBase} w-full pr-12`}
              />
              <button
                type="button"
                data-testid="login-password-toggle"
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

          {error && (
            <p
              role="alert"
              data-testid="login-error"
              className="flex items-start gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200 animate-fade-in"
            >
              <LuCircleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className={`${submitBase} animate-fade-up [animation-delay:240ms]`}
          >
            {pending ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <div className="mt-6 flex flex-col gap-2 text-sm text-zinc-500 animate-fade-up [animation-delay:320ms]">
          <p className="flex items-center gap-2">
            <LuKeyRound aria-hidden className="h-4 w-4 text-sensu-500" />
            <span>
              ¿Olvidaste tu contraseña?{' '}
              <Link
                href="/forgot-password"
                data-testid="login-forgot-link"
                className="text-sensu-600 transition-colors hover:text-sensu-700"
              >
                Recuperarla
              </Link>
            </span>
          </p>
          <p>
            ¿No tienes cuenta?{' '}
            <Link
              href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ''}`}
              className="text-sensu-600 transition-colors hover:text-sensu-700"
            >
              Crear cuenta
            </Link>
          </p>
        </div>

        <Link
          href="/signup/familiar"
          data-testid="login-family-link"
          className="mt-6 flex items-center justify-between gap-3 rounded-2xl bg-sensu-50/70 px-4 py-3 ring-1 ring-sensu-200/70 transition-colors hover:bg-sensu-50 animate-fade-up [animation-delay:520ms]"
        >
          <span className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-sensu-200">
              <LuUsers aria-hidden className="h-4 w-4 text-sensu-500" />
            </span>
            <span className="text-sm text-zinc-700">
              <span className="font-medium text-zinc-900">¿Eres familiar de un usuario Sensu?</span>
              <span className="block text-xs text-zinc-500">
                Únete como observador con el IMEI y el ID que te compartieron.
              </span>
            </span>
          </span>
          <span aria-hidden className="text-sm font-medium text-sensu-600">→</span>
        </Link>

        {/*
          Juan 2026-04-20 ask, shipped at /signup/claim 2026-05-07, but
          discoverability was missing through 2026-06-30 — the IMEI-only
          flat signup had no surface on /login, so a relative with the
          box but no QR-share invitation had no path in. This card pulls
          the existing flow forward where buyers actually land first.
        */}
        <Link
          href="/signup/claim"
          data-testid="login-claim-link"
          className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-emerald-50/70 px-4 py-3 ring-1 ring-emerald-200/70 transition-colors hover:bg-emerald-50 animate-fade-up [animation-delay:560ms]"
        >
          <span className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-emerald-200">
              <LuRadio aria-hidden className="h-4 w-4 text-emerald-600" />
            </span>
            <span className="text-sm text-zinc-700">
              <span className="font-medium text-zinc-900">¿Ya tienes el botón Sensu?</span>
              <span className="block text-xs text-zinc-500">
                Actívalo con el IMEI impreso en la caja, sin contraseña adicional.
              </span>
            </span>
          </span>
          <span aria-hidden className="text-sm font-medium text-emerald-700">→</span>
        </Link>
      </div>
    </main>
  );
}
