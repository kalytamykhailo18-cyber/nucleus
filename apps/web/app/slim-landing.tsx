import Link from 'next/link';
import { LuLogIn, LuPlus, LuRadio } from 'react-icons/lu';
import { env } from '@/lib/env';

/**
 * Slim landing — only rendered on `/` when
 * `NUCLEUS_MARKETING_OFFLOADED=on`. The full marketing copy + plan
 * picker + audience pages stop being Nucleus's job at that point,
 * since the sales-managed marketing site at sensu.com.mx owns the
 * brand front door (Juan 2026-06-29 strategic split).
 *
 * What stays here:
 *   - Login card → /login (existing returning-user flow)
 *   - IMEI activation card → /signup/claim (the relative-with-the-box
 *     flow Juan unblocked yesterday)
 *   - New-account CTA → marketing site's /planes (where the buyer
 *     journey starts)
 *
 * Anonymous-visitor surface only — admins still see the full
 * inline-CMS marketing render because the page.tsx branch checks
 * `isAdmin` before this component is mounted.
 */
export function SlimLanding(): React.ReactElement {
  const marketingBase = env.NUCLEUS_MARKETING_SITE_BASE_URL.replace(/\/$/, '');
  // When the marketing site is not yet fully cutover
  // (NUCLEUS_MARKETING_OFFLOADED still off), the "Crear cuenta nueva"
  // card and the top-of-page marketing pointer link into Nucleus's
  // own /planes so buyers can still complete a purchase. Once
  // marketing-offloaded flips on, both switch to the external
  // sensu.com.mx URL. This lets Juan shrink the landing NOW without
  // waiting for Lovable's custom-domain claim to be finished.
  const newAccountHref = env.NUCLEUS_MARKETING_OFFLOADED
    ? `${marketingBase}/planes`
    : '/planes';
  const marketingPointerHref = env.NUCLEUS_MARKETING_OFFLOADED
    ? `${marketingBase}/`
    : '/planes';
  return (
    <main
      data-testid="nucleus-home-slim"
      className="flex flex-1 flex-col items-center justify-center px-6 py-24"
    >
      <div className="w-full max-w-xl text-center">
        <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
          Sensu Angela · Nucleus
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
          Bienvenido a tu Sensu.
        </h1>
        <p className="mt-3 text-base text-zinc-600">
          {env.NUCLEUS_MARKETING_OFFLOADED ? (
            <>
              Para conocer el servicio, visita{' '}
              <a
                data-testid="nucleus-home-slim-marketing-link"
                href={marketingPointerHref}
                className="font-medium text-sensu-700 underline-offset-2 hover:underline"
              >
                sensu.com.mx
              </a>
              . Si ya eres cliente o vas a activar tu botón, usa una
              de las opciones de abajo.
            </>
          ) : (
            <>
              Elige una opción para iniciar sesión, activar tu botón, o
              conocer los planes.
            </>
          )}
        </p>

        <div className="mt-10 grid gap-3">
          <Link
            href="/login"
            data-testid="nucleus-home-slim-login"
            className="card-surface card-surface-hoverable flex items-center justify-between gap-3 rounded-2xl p-5 text-left transition-transform hover:-translate-y-0.5"
          >
            <span className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sensu-50 text-sensu-600">
                <LuLogIn aria-hidden className="h-5 w-5" />
              </span>
              <span>
                <span className="block font-medium text-zinc-900">
                  Iniciar sesión
                </span>
                <span className="block text-xs text-zinc-500">
                  Para clientes con cuenta activa.
                </span>
              </span>
            </span>
            <span aria-hidden className="text-sm font-medium text-sensu-600">→</span>
          </Link>

          <Link
            href="/signup/claim"
            data-testid="nucleus-home-slim-claim"
            className="card-surface card-surface-hoverable flex items-center justify-between gap-3 rounded-2xl p-5 text-left transition-transform hover:-translate-y-0.5"
          >
            <span className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <LuRadio aria-hidden className="h-5 w-5" />
              </span>
              <span>
                <span className="block font-medium text-zinc-900">
                  Activar mi botón Sensu
                </span>
                <span className="block text-xs text-zinc-500">
                  Tengo la caja, quiero crear mi cuenta con el IMEI.
                </span>
              </span>
            </span>
            <span aria-hidden className="text-sm font-medium text-emerald-700">→</span>
          </Link>

          <a
            href={newAccountHref}
            data-testid="nucleus-home-slim-new-account"
            className="card-surface card-surface-hoverable flex items-center justify-between gap-3 rounded-2xl p-5 text-left transition-transform hover:-translate-y-0.5"
          >
            <span className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-600">
                <LuPlus aria-hidden className="h-5 w-5" />
              </span>
              <span>
                <span className="block font-medium text-zinc-900">
                  Crear cuenta nueva
                </span>
                <span className="block text-xs text-zinc-500">
                  {env.NUCLEUS_MARKETING_OFFLOADED
                    ? 'Conoce los planes en sensu.com.mx y compra tu botón.'
                    : 'Elige un plan y compra tu botón.'}
                </span>
              </span>
            </span>
            <span aria-hidden className="text-sm font-medium text-sky-700">→</span>
          </a>
        </div>
      </div>
    </main>
  );
}
