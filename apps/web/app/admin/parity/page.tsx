import { LuGitCompareArrows, LuActivity, LuTarget } from 'react-icons/lu';
import { requireAdmin } from '@/lib/admin';
import {
  fetchParitySummary,
  fetchParityRecent,
  fetchPhaseAParityMetric,
} from '@/lib/parity';
import { SectionLabel } from '@/components/section-label';
import { PaginationNav } from '@/components/pagination-nav';

const PAGE_SIZE = 20;

const SOURCE_TONE: Record<string, string> = {
  TS: 'bg-sky-50 text-sky-700 ring-sky-200',
  PYTHON: 'bg-violet-50 text-violet-700 ring-violet-200',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default async function AdminParityPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const pageNumber = (() => {
    const n = Number(params.page);
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
  })();
  const [summary, recent, phaseA] = await Promise.all([
    fetchParitySummary(),
    fetchParityRecent(pageNumber, PAGE_SIZE),
    fetchPhaseAParityMetric(),
  ]);
  const daysDisplay = phaseA.daysIntoWindow.toFixed(1);
  const onTrack = phaseA.matchRatePct >= 99;

  return (
    <main
      data-testid="admin-parity"
      className="flex flex-1 flex-col items-center px-6 py-12"
    >
      <div className="w-full max-w-7xl">
        <header>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900">
            Paridad MQTT
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Comparador de eventos entre el suscriptor TypeScript y el
            histórico de Python. Cero divergencias durante 7 días seguidos
            cierra la ventana de paridad.
          </p>
        </header>

        <section
          data-testid="parity-phase-a"
          className={`mt-8 card-surface rounded-3xl p-6 ring-1 ring-inset ${onTrack ? 'ring-emerald-200' : 'ring-amber-200'}`}
        >
          <SectionLabel icon={LuTarget} tone={onTrack ? 'emerald' : 'amber'}>
            Ventana de aceptación Phase A · 7 días
          </SectionLabel>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                Match rate (flota UserDevice)
              </p>
              <p
                data-testid="parity-match-rate"
                className={`mt-1 text-3xl font-semibold tabular-nums ${onTrack ? 'text-emerald-700' : 'text-amber-700'}`}
              >
                {phaseA.matchRatePct.toFixed(1)}%
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {phaseA.matchedPairs} de {phaseA.tsObservations} observaciones TS
                tienen pareja PYTHON dentro de ±1s.
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                Días dentro de la ventana
              </p>
              <p
                data-testid="parity-days-into-window"
                className="mt-1 text-3xl font-semibold tabular-nums text-zinc-900"
              >
                {daysDisplay} / 7
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Arranque: {formatDate(phaseA.windowStartIso)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                Divergencias TS sin pareja
              </p>
              <p
                data-testid="parity-unmatched-ts"
                className={`mt-1 text-3xl font-semibold tabular-nums ${phaseA.unmatchedTs === 0 ? 'text-emerald-700' : 'text-rose-700'}`}
              >
                {phaseA.unmatchedTs.toLocaleString('es-MX')}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Cero durante 7 días = bullet 3 cerrado.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-3 sm:grid-cols-3">
          <Stat label="Eventos TS (total)" value={summary.tsCount} testId="parity-ts-count" tone="sky" />
          <Stat label="Eventos Python (total)" value={summary.pythonCount} testId="parity-python-count" tone="violet" />
          <Stat
            label="Divergencias (legacy flag)"
            value={summary.divergentCount}
            testId="parity-divergent-count"
            tone={summary.divergentCount === 0 ? 'emerald' : 'rose'}
          />
        </section>

        <p
          data-testid="parity-window"
          className="mt-3 text-xs text-zinc-500"
        >
          Ventana observada: {formatDate(summary.oldestObservation)} → {formatDate(summary.newestObservation)}
        </p>

        <section className="mt-8">
          <SectionLabel icon={LuActivity} tone="sky">
            Eventos recientes
          </SectionLabel>
          {recent.rows.length === 0 ? (
            <p
              data-testid="parity-empty"
              className="card-surface mt-3 rounded-3xl px-6 py-10 text-center text-sm text-zinc-500"
            >
              Aún no hay observaciones de paridad. El suscriptor TS escribirá la
              primera fila apenas llegue un mensaje del LocTube.
            </p>
          ) : (
            <>
            <PaginationNav
              currentPage={recent.page}
              totalPages={recent.totalPages}
              totalRows={recent.totalRows}
              pageSize={recent.pageSize}
              baseHref="/admin/parity"
              testIdPrefix="admin-parity-pagination"
              position="top"
            />
            {/* Mobile (≤sm) — stacked cards. On a 390px phone the wide
                parity table would scroll horizontally, hiding the
                Diverge column behind the device-id; cards surface every
                field at once and read in one column. */}
            <ul
              data-testid="parity-card-list"
              className="mt-2 space-y-3 sm:hidden"
            >
              {recent.rows.map((r) => (
                <li
                  key={`mobile-${r.id}`}
                  data-testid={`parity-card-${r.id}`}
                  className="card-surface rounded-2xl p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${SOURCE_TONE[r.source] ?? 'bg-zinc-100 text-zinc-700 ring-zinc-200'}`}
                    >
                      {r.source}
                    </span>
                    <span className="text-sm font-medium text-zinc-900">
                      {r.eventType}
                    </span>
                    {r.divergent ? (
                      <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-rose-600">
                        <LuGitCompareArrows aria-hidden className="h-3.5 w-3.5" />
                        diverge
                      </span>
                    ) : (
                      <span className="ml-auto text-xs text-emerald-600">
                        sin divergencia
                      </span>
                    )}
                  </div>
                  <p className="mt-2 break-all font-mono text-xs text-zinc-600">
                    {r.eviewDeviceId}
                  </p>
                  <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                    <dt className="text-zinc-500">Timestamp</dt>
                    <dd className="text-right tabular-nums text-zinc-700">
                      {formatDate(r.timestamp)}
                    </dd>
                    <dt className="text-zinc-500">EviewEvent</dt>
                    <dd className="text-right break-all font-mono text-zinc-500">
                      {r.eviewEventId ?? '—'}
                    </dd>
                  </dl>
                </li>
              ))}
            </ul>

            <div className="hidden sm:block card-surface mt-2 overflow-x-auto rounded-3xl">
              <table
                data-testid="parity-table"
                className="w-full min-w-[820px] text-left text-sm"
              >
                <thead className="bg-zinc-50 text-xs uppercase tracking-[0.14em] text-zinc-500">
                  <tr>
                    <th className="whitespace-nowrap px-5 py-3 font-medium">Fuente</th>
                    <th className="whitespace-nowrap px-5 py-3 font-medium">Dispositivo</th>
                    <th className="whitespace-nowrap px-5 py-3 font-medium">Evento</th>
                    <th className="whitespace-nowrap px-5 py-3 font-medium tabular-nums">Timestamp</th>
                    <th className="whitespace-nowrap px-5 py-3 font-medium">EviewEvent</th>
                    <th className="whitespace-nowrap px-5 py-3 font-medium">Diverge</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {recent.rows.map((r) => (
                    <tr
                      key={r.id}
                      data-testid={`parity-row-${r.id}`}
                    >
                      <td className="whitespace-nowrap px-5 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${SOURCE_TONE[r.source] ?? 'bg-zinc-100 text-zinc-700 ring-zinc-200'}`}
                        >
                          {r.source}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-zinc-700">
                        {r.eviewDeviceId}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-zinc-700">{r.eventType}</td>
                      <td className="whitespace-nowrap px-5 py-3 tabular-nums text-zinc-500">
                        {formatDate(r.timestamp)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-zinc-500">
                        {r.eviewEventId ?? '—'}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3">
                        {r.divergent ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-600">
                            <LuGitCompareArrows aria-hidden className="h-3.5 w-3.5" />
                            sí
                          </span>
                        ) : (
                          <span className="text-xs text-emerald-600">no</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationNav
              currentPage={recent.page}
              totalPages={recent.totalPages}
              totalRows={recent.totalRows}
              pageSize={recent.pageSize}
              baseHref="/admin/parity"
              testIdPrefix="admin-parity-pagination"
              position="bottom"
            />
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  testId,
  tone,
}: {
  label: string;
  value: number;
  testId: string;
  tone: 'sky' | 'violet' | 'emerald' | 'rose';
}) {
  const ring = {
    sky: 'ring-sky-200',
    violet: 'ring-violet-200',
    emerald: 'ring-emerald-200',
    rose: 'ring-rose-200',
  }[tone];
  const text = {
    sky: 'text-sky-700',
    violet: 'text-violet-700',
    emerald: 'text-emerald-700',
    rose: 'text-rose-700',
  }[tone];
  return (
    <div
      data-testid={testId}
      className={`card-surface rounded-3xl p-6 ring-1 ring-inset ${ring}`}
    >
      <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tabular-nums ${text}`}>
        {value.toLocaleString('es-MX')}
      </p>
    </div>
  );
}
