import { LuGitCompareArrows, LuCheck } from 'react-icons/lu';
import { requireAdmin } from '@/lib/admin';

/**
 * Retired 2026-08-26. Phase A parity closed with 0 divergences across
 * 3.5 months of observation. The WorkerParityCheck table was truncated,
 * both subscribers stopped writing new rows, and this page collapsed to
 * a static confirmation so an admin landing here understands the state
 * without a broken empty dashboard.
 *
 * If we ever need parity checking again (e.g. a second worker rewrite),
 * restore this file from git blame plus lib/parity.ts and the two
 * recordParityCheck writers in apps/worker/src/parity.ts and
 * sensu-api/core/database.py _record_parity_observation.
 */
export const dynamic = 'force-dynamic';

export default async function AdminParityPage(): Promise<React.ReactElement> {
  await requireAdmin();
  return (
    <main
      data-testid="admin-parity"
      className="flex flex-1 flex-col items-center px-6 py-12"
    >
      <div className="w-full max-w-3xl">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900">
          Paridad MQTT
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Comparador entre suscriptor TypeScript e histórico Python.
        </p>

        <section
          className="mt-8 card-surface rounded-3xl p-8 ring-1 ring-inset ring-emerald-200"
        >
          <div className="flex items-center gap-3 text-emerald-700">
            <LuCheck aria-hidden className="h-5 w-5" />
            <p className="text-sm font-semibold uppercase tracking-[0.14em]">
              Ventana cerrada
            </p>
          </div>
          <p className="mt-4 text-lg text-zinc-900">
            Phase A cerró con 0 divergencias sobre 3.5 meses de observación.
          </p>
          <p className="mt-3 text-sm text-zinc-500">
            Se dio de baja la subsistema completo el 2026-08-26. Los dos
            suscriptores dejaron de escribir observaciones nuevas y la
            tabla histórica se truncó para mantener limpia la base de
            datos. Los eventos reales siguen en <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">EviewEvent</code> como
            siempre; esta pantalla solo describía el gate de validación.
          </p>
          <div className="mt-6 flex items-center gap-2 text-xs text-zinc-500">
            <LuGitCompareArrows aria-hidden className="h-3.5 w-3.5" />
            Restaurar desde git blame si se necesita comparar suscriptores
            de nuevo en el futuro.
          </div>
        </section>
      </div>
    </main>
  );
}
