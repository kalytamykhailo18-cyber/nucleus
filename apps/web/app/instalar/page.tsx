import type { Metadata } from 'next';
import Link from 'next/link';
import {
  LuApple,
  LuArrowRight,
  LuPhone,
  LuPlus,
  LuShare,
  LuSmartphone,
} from 'react-icons/lu';
import { SectionLabel } from '@/components/section-label';
import { sensuContact } from '@/lib/contact-info';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Instala Sensu en tu teléfono',
  description:
    'Guarda Sensu en tu pantalla de inicio en menos de un minuto. Funciona en iPhone y en Android, sin pasar por App Store.',
};

/**
 * /instalar — PWA install tutorial page (Juan 2026-06-16).
 *
 * Promotes the PWA we shipped 2026-06-15. Each platform gets its own
 * step-by-step card. iOS Safari is the only path that needs a manual
 * "Add to Home Screen" — Android Chrome shows the native install
 * prompt automatically once the user has visited the site once.
 */
export default function InstalarPage(): React.ReactElement {
  const callcenter = sensuContact.callcenter();
  return (
    <main
      data-testid="instalar-page"
      className="flex flex-1 flex-col items-center px-6 pt-12 pb-12"
    >
      <div className="w-full max-w-3xl">
        <SectionLabel icon={LuSmartphone} tone="sensu">
          Instala Sensu
        </SectionLabel>
        <h1 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900">
          Sensu en tu teléfono en un minuto
        </h1>
        <p className="mt-3 text-base text-zinc-500">
          Guarda Sensu como una app en la pantalla de inicio de tu
          teléfono. Recibes las alertas con sonido, abres el panel
          familiar con un toque y no necesitas pasar por la App Store
          ni Google Play.
        </p>

        <section
          data-testid="instalar-android"
          className="card-surface mt-8 rounded-3xl p-6"
        >
          <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-900">
            <LuSmartphone aria-hidden className="h-5 w-5 text-emerald-500" />
            Android (Chrome)
          </h2>
          <p className="mt-2 text-sm text-zinc-600">
            Chrome muestra un aviso de "Instalar" automáticamente
            cuando entras a app.sensu.com.mx. Si no aparece, sigue
            estos pasos:
          </p>
          <ol className="mt-4 list-none space-y-3 text-sm text-zinc-700">
            <Step number={1}>
              Abre Chrome en tu teléfono y entra a{' '}
              <span className="font-mono text-sensu-700">
                app.sensu.com.mx
              </span>
              .
            </Step>
            <Step number={2}>
              Toca el ícono de tres puntos en la esquina superior
              derecha.
            </Step>
            <Step number={3}>
              Elige <span className="font-medium">Agregar a la pantalla principal</span> o{' '}
              <span className="font-medium">Instalar app</span>.
            </Step>
            <Step number={4}>
              Confirma. El ícono de Sensu aparece junto al resto de tus
              apps.
            </Step>
          </ol>
        </section>

        <section
          data-testid="instalar-ios"
          className="card-surface mt-6 rounded-3xl p-6"
        >
          <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-900">
            <LuApple aria-hidden className="h-5 w-5 text-zinc-800" />
            iPhone (Safari)
          </h2>
          <p className="mt-2 text-sm text-zinc-600">
            En iPhone necesitas usar Safari. Otros navegadores como
            Chrome para iOS no permiten instalar la app.
          </p>
          <ol className="mt-4 list-none space-y-3 text-sm text-zinc-700">
            <Step number={1}>
              Abre Safari en tu iPhone y entra a{' '}
              <span className="font-mono text-sensu-700">
                app.sensu.com.mx
              </span>
              .
            </Step>
            <Step number={2}>
              Toca el botón{' '}
              <span className="inline-flex items-center gap-1 font-medium text-sky-700">
                <LuShare aria-hidden className="h-3.5 w-3.5" />
                Compartir
              </span>{' '}
              en la barra inferior.
            </Step>
            <Step number={3}>
              Baja en el menú y elige{' '}
              <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                <LuPlus aria-hidden className="h-3.5 w-3.5" />
                Agregar a inicio
              </span>
              .
            </Step>
            <Step number={4}>
              Toca <span className="font-medium">Agregar</span> en la
              esquina superior derecha. El ícono de Sensu aparece en
              tu pantalla de inicio.
            </Step>
          </ol>
        </section>

        <section className="card-surface mt-6 rounded-3xl p-6">
          <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-900">
            <LuPhone aria-hidden className="h-5 w-5 text-sensu-500" />
            ¿Necesitas ayuda?
          </h2>
          <p className="mt-2 text-sm text-zinc-600">
            Si algo no funciona, llámanos al call-center 24/7 al{' '}
            <a
              href={`tel:${callcenter.tel}`}
              className="font-medium text-sensu-700 underline-offset-2 hover:underline"
            >
              {callcenter.display}
            </a>{' '}
            y te ayudamos paso a paso.
          </p>
        </section>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="https://app.sensu.com.mx"
            data-testid="instalar-open-app"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-sensu-500 px-5 text-sm font-medium tracking-tight text-white shadow-[0_10px_30px_rgba(244,63,94,0.35)] transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
          >
            Abrir app.sensu.com.mx
            <LuArrowRight aria-hidden className="h-4 w-4" />
          </Link>
          <Link
            href="/soporte"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-medium tracking-tight text-zinc-700 ring-1 ring-inset ring-zinc-200 transition-colors hover:bg-zinc-50"
          >
            Ver más ayuda
          </Link>
        </div>
      </div>
    </main>
  );
}

function Step({
  number,
  children,
}: {
  number: number;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sensu-50 text-xs font-semibold text-sensu-700 ring-1 ring-sensu-200"
      >
        {number}
      </span>
      <span className="flex-1">{children}</span>
    </li>
  );
}
