'use client';

import { useActionState, useEffect, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LuCircleAlert, LuEye, LuEyeOff, LuShield, LuUsers } from 'react-icons/lu';
import {
  familyClaimAction,
  type FamilyClaimState,
} from '@/lib/actions/family-claim';

const initialState: FamilyClaimState = { ok: false };

const fieldBase =
  'h-11 rounded-xl border border-zinc-200 bg-white px-4 text-zinc-900 transition-all duration-200 ease-[cubic-bezier(.32,.72,0,1)] placeholder:text-zinc-400 hover:border-zinc-300 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300/60';

const submitBase =
  'mt-1 inline-flex h-11 items-center justify-center rounded-full bg-sensu-500 px-6 text-sm font-medium tracking-tight text-white transition-transform duration-200 ease-[cubic-bezier(.32,.72,0,1)] hover:-translate-y-0.5 active:scale-[0.98] disabled:cursor-progress disabled:opacity-60 disabled:hover:translate-y-0 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sensu-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white';

export default function FamilyClaimForm(): React.ReactElement {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    familyClaimAction,
    initialState,
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [autoSignInError, setAutoSignInError] = useState<string | null>(null);

  useEffect(() => {
    if (!state.ok) return;
    let cancelled = false;
    (async () => {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });
      if (cancelled) return;
      if (!result || result.error) {
        setAutoSignInError(
          'Cuenta creada, pero no pudimos iniciar sesión automáticamente. Intenta entrar manualmente.',
        );
        return;
      }
      router.replace('/dashboard');
      router.refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [state.ok, email, password, router]);

  return (
    <main
      data-testid="family-claim-page"
      className="min-h-screen flex items-center justify-center px-6 py-16"
    >
      <div className="card-surface w-full max-w-md rounded-3xl p-8 animate-rise">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-sensu-600">
          <LuUsers aria-hidden className="h-4 w-4" />
          <span>Reclama tu Angela</span>
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900 animate-fade-up [animation-delay:60ms]">
          Únete con el IMEI de la caja
        </h1>
        <p className="mt-2 text-sm text-zinc-500 animate-fade-up [animation-delay:120ms]">
          Captura el IMEI impreso en la caja de la Angela y crea tu cuenta —
          todos los familiares con el IMEI tienen el mismo acceso al panel.
        </p>

        <form
          action={formAction}
          aria-label="family-claim-form"
          className="mt-7 flex flex-col gap-5"
        >
          <label className="flex flex-col gap-2 text-sm animate-fade-up [animation-delay:180ms]">
            <span className="flex items-center gap-1.5 text-zinc-600">
              <LuShield aria-hidden className="h-4 w-4 text-sensu-500" />
              IMEI del dispositivo
            </span>
            <input
              type="text"
              name="imei"
              data-testid="family-claim-imei"
              autoComplete="off"
              spellCheck={false}
              minLength={8}
              maxLength={64}
              required
              className={`${fieldBase} font-mono`}
            />
            <span className="text-[11px] leading-snug text-zinc-500">
              El número impreso en la caja. Si tu familiar ya recibió una
              llamada del call-center, la Angela ya está lista para reclamarse.
            </span>
          </label>

          <hr className="my-1 border-zinc-200/70" />

          <label className="flex flex-col gap-2 text-sm animate-fade-up [animation-delay:240ms]">
            <span className="text-zinc-600">Tu nombre completo</span>
            <input
              type="text"
              name="fullName"
              data-testid="family-claim-fullName"
              autoComplete="name"
              className={fieldBase}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm animate-fade-up [animation-delay:300ms]">
            <span className="text-zinc-600">Tu email</span>
            <input
              type="email"
              name="email"
              data-testid="family-claim-email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={fieldBase}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm animate-fade-up [animation-delay:360ms]">
            <span className="text-zinc-600">Crea una contraseña (mín. 8)</span>
            <span className="relative block">
              <input
                type={reveal ? 'text' : 'password'}
                name="password"
                data-testid="family-claim-password"
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={`${fieldBase} w-full pr-12`}
              />
              <button
                type="button"
                data-testid="family-claim-password-toggle"
                aria-label={reveal ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                aria-pressed={reveal}
                onClick={() => setReveal((r) => !r)}
                className="absolute inset-y-0 right-2 inline-flex items-center justify-center rounded-full px-2 text-sky-500 transition-colors hover:bg-sky-50 hover:text-sky-700 cursor-pointer"
              >
                {reveal ? (
                  <LuEyeOff aria-hidden className="h-4 w-4 text-sky-500" />
                ) : (
                  <LuEye aria-hidden className="h-4 w-4 text-sky-500" />
                )}
              </button>
            </span>
          </label>

          {state.error ? (
            <p
              role="alert"
              data-testid="family-claim-error"
              className="flex items-start gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200 animate-fade-in"
            >
              <LuCircleAlert
                aria-hidden
                className="mt-0.5 h-4 w-4 shrink-0 text-rose-500"
              />
              {state.error}
            </p>
          ) : null}
          {autoSignInError ? (
            <p
              role="alert"
              data-testid="family-claim-error"
              className="flex items-start gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200 animate-fade-in"
            >
              <LuCircleAlert
                aria-hidden
                className="mt-0.5 h-4 w-4 shrink-0 text-rose-500"
              />
              {autoSignInError}
            </p>
          ) : null}

          <button
            type="submit"
            data-testid="family-claim-submit"
            disabled={pending}
            className={`${submitBase} animate-fade-up [animation-delay:420ms]`}
          >
            {pending ? 'Reclamando…' : 'Reclamar y entrar'}
          </button>
        </form>

        <div className="mt-6 text-sm text-zinc-500 animate-fade-up [animation-delay:500ms]">
          <p>
            ¿Te invitaron por correo o tienes un ID de cliente?{' '}
            <Link
              href="/signup/familiar"
              className="text-sensu-600 transition-colors hover:text-sensu-700"
            >
              Únete con invitación
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
