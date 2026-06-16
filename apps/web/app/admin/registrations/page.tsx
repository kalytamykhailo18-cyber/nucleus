import Link from 'next/link';
import { LuClipboardList, LuDownload, LuLink2, LuArrowRight } from 'react-icons/lu';
import { requireAdmin, fetchRegistrations } from '@/lib/admin';
import { SectionLabel } from '@/components/section-label';
import { PaginationNav } from '@/components/pagination-nav';
import { cadenceLabel, type BillingCadence } from '@/lib/plans';

const PAGE_SIZE = 50;

const STATUS_TONE: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  PENDING_PAYMENT: 'bg-amber-50 text-amber-700 ring-amber-200',
  PAST_DUE: 'bg-rose-50 text-rose-700 ring-rose-200',
  CANCELLED: 'bg-zinc-100 text-zinc-600 ring-zinc-200',
};

function formatPesos(centavos: number | null): string {
  if (centavos === null) return '—';
  const major = Math.floor(centavos / 100);
  return `$${major.toLocaleString('es-MX')}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRenewal(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-MX', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export default async function AdminRegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; from?: string; to?: string; page?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const planType =
    params.plan === 'ANGELA_ESENCIAL' || params.plan === 'ANGELA_TOTAL'
      ? params.plan
      : undefined;
  const pageNumber = (() => {
    const n = Number(params.page);
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
  })();
  const { rows, totalRows, totalPages, page } = await fetchRegistrations(
    {
      planType,
      fromIso: params.from,
      toIso: params.to,
    },
    pageNumber,
    PAGE_SIZE,
  );

  const exportQuery = new URLSearchParams();
  if (planType) exportQuery.set('plan', planType);
  if (params.from) exportQuery.set('from', params.from);
  if (params.to) exportQuery.set('to', params.to);

  // Build the pagination base href so chip clicks preserve the active
  // filters; PaginationNav writes its own `page` param onto this.
  const baseHrefParams = new URLSearchParams();
  if (planType) baseHrefParams.set('plan', planType);
  if (params.from) baseHrefParams.set('from', params.from);
  if (params.to) baseHrefParams.set('to', params.to);
  const baseHref = `/admin/registrations${baseHrefParams.toString() ? `?${baseHrefParams.toString()}` : ''}`;

  return (
    <main
      data-testid="admin-registrations"
      className="flex flex-1 flex-col items-center px-6 py-12"
    >
      <div className="w-full max-w-7xl">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900">
              Registros
            </h1>
            <p className="mt-2 text-sm text-zinc-500">
              {totalRows === 1
                ? '1 registro'
                : `${totalRows.toLocaleString('es-MX')} registros`}
              {planType ? ` · plan ${planType === 'ANGELA_TOTAL' ? 'Total' : 'Esencial'}` : ''}
            </p>
          </div>
          <Link
            href={`/api/admin/export.csv?${exportQuery.toString()}`}
            data-testid="admin-export-csv"
            className="inline-flex h-10 items-center gap-2 rounded-full bg-sensu-500 px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
          >
            <LuDownload aria-hidden className="h-4 w-4" />
            Exportar CSV
          </Link>
        </header>

        <section className="mt-6">
          <SectionLabel icon={LuClipboardList} tone="sky">
            Filtros
          </SectionLabel>
          <form
            data-testid="admin-filters"
            method="get"
            className="card-surface mt-3 flex flex-wrap items-end gap-3 rounded-2xl px-5 py-4"
          >
            <label className="text-sm">
              <span className="block text-xs uppercase tracking-[0.14em] text-zinc-500">Plan</span>
              <select
                name="plan"
                data-testid="admin-filter-plan"
                defaultValue={planType ?? ''}
                className="mt-1.5 block w-44 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-sensu-400 focus:ring-2 focus:ring-sensu-200"
              >
                <option value="">Todos</option>
                <option value="ANGELA_ESENCIAL">Esencial</option>
                {/* Total tier retired 2026-06-02 (Cruz Roja partnership
                    moved its features to lower-cost coverage). The option
                    is hidden so admins do not filter for a tier we no
                    longer sell, but the table column still displays the
                    "Total" badge for any grandfathered rows. */}
              </select>
            </label>
            <label className="text-sm">
              <span className="block text-xs uppercase tracking-[0.14em] text-zinc-500">Desde</span>
              <input
                type="date"
                name="from"
                data-testid="admin-filter-from"
                defaultValue={params.from ?? ''}
                className="mt-1.5 block rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-sensu-400 focus:ring-2 focus:ring-sensu-200"
              />
            </label>
            <label className="text-sm">
              <span className="block text-xs uppercase tracking-[0.14em] text-zinc-500">Hasta</span>
              <input
                type="date"
                name="to"
                data-testid="admin-filter-to"
                defaultValue={params.to ?? ''}
                className="mt-1.5 block rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-sensu-400 focus:ring-2 focus:ring-sensu-200"
              />
            </label>
            <button
              type="submit"
              data-testid="admin-filter-apply"
              className="inline-flex h-10 items-center rounded-full bg-zinc-900 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
            >
              Aplicar
            </button>
          </form>
        </section>

        <section className="mt-8">
          {rows.length === 0 ? (
            <p
              data-testid="admin-empty"
              className="card-surface rounded-3xl px-6 py-10 text-center text-sm text-zinc-500"
            >
              Sin registros para los filtros seleccionados.
            </p>
          ) : (
            <>
            <PaginationNav
              currentPage={page}
              totalPages={totalPages}
              totalRows={totalRows}
              pageSize={PAGE_SIZE}
              baseHref={baseHref}
              testIdPrefix="admin-registrations-pagination"
              position="top"
            />
            {/* Mobile (≤sm) — stacked cards, one per row. Below the
                sm breakpoint the table would horizontally scroll inside
                its card, which on a 390px phone makes the right-hand
                columns invisible until the admin scrolls; the stacked
                shape surfaces every field without scrolling. */}
            <ul
              data-testid="admin-card-list"
              className="space-y-3 sm:hidden"
            >
              {rows.map((r) => (
                <li
                  key={`mobile-${r.subscriptionId}`}
                  data-testid={`admin-card-${r.subscriptionId}`}
                  className="card-surface rounded-2xl p-4"
                >
                  <p className="break-all text-sm font-medium text-zinc-900">
                    {r.email}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {r.fullName ?? '—'}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <span
                      data-testid={`admin-card-${r.subscriptionId}-plan`}
                      className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 font-medium text-zinc-700 ring-1 ring-inset ring-zinc-200"
                    >
                      {r.planType === 'ANGELA_TOTAL' ? 'Total' : 'Esencial'}
                    </span>
                    {r.cadence && (
                      <span
                        data-testid={`admin-card-${r.subscriptionId}-cadence`}
                        className="inline-flex items-center rounded-full bg-sensu-50 px-2.5 py-0.5 font-medium text-sensu-700 ring-1 ring-inset ring-sensu-200"
                      >
                        {cadenceLabel(r.cadence as BillingCadence)}
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-medium ring-1 ring-inset ${STATUS_TONE[r.status] ?? 'bg-zinc-100 text-zinc-700 ring-zinc-200'}`}
                    >
                      {r.status}
                    </span>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                    <dt className="text-zinc-500">Pago</dt>
                    <dd className="text-right tabular-nums text-zinc-700">
                      {formatPesos(r.amountPaidCentavos)}
                    </dd>
                    <dt className="text-zinc-500">Renovación</dt>
                    <dd
                      data-testid={`admin-card-${r.subscriptionId}-renewal`}
                      className="text-right tabular-nums text-zinc-500"
                    >
                      {formatRenewal(r.currentPeriodEnd)}
                    </dd>
                    <dt className="text-zinc-500">Compra</dt>
                    <dd className="text-right tabular-nums text-zinc-500">
                      {formatDate(r.purchaseDate ?? r.createdAt)}
                    </dd>
                  </dl>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Link
                      href={`/admin/registrations/${r.subscriptionId}`}
                      data-testid={`admin-card-${r.subscriptionId}-detail`}
                      className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200 transition-colors hover:bg-zinc-50"
                    >
                      Ver detalle
                      <LuArrowRight aria-hidden className="h-3 w-3" />
                    </Link>
                    {!r.hasPairedDevice && r.status === 'ACTIVE' && (
                      <Link
                        href={`/admin/dispatch?focus=${r.subscriptionId}`}
                        data-testid={`admin-card-${r.subscriptionId}-pair`}
                        className="inline-flex items-center gap-1 rounded-full bg-sensu-50 px-3 py-1 text-xs font-medium text-sensu-700 ring-1 ring-sensu-200 transition-colors hover:bg-sensu-100"
                      >
                        <LuLink2 aria-hidden className="h-3 w-3" />
                        Asignar IMEI
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            <div className="hidden sm:block card-surface overflow-x-auto rounded-3xl">
              <table
                data-testid="admin-table"
                className="w-full min-w-[940px] text-left text-sm"
              >
                <thead className="bg-zinc-50 text-xs uppercase tracking-[0.14em] text-zinc-500">
                  <tr>
                    <th className="whitespace-nowrap px-5 py-3 font-medium">Email</th>
                    <th className="whitespace-nowrap px-5 py-3 font-medium">Nombre</th>
                    <th className="whitespace-nowrap px-5 py-3 font-medium">Plan</th>
                    <th className="whitespace-nowrap px-5 py-3 font-medium">Cadencia</th>
                    <th className="whitespace-nowrap px-5 py-3 font-medium">Estado</th>
                    <th className="whitespace-nowrap px-5 py-3 font-medium tabular-nums">Pago</th>
                    <th className="whitespace-nowrap px-5 py-3 font-medium tabular-nums">Renovación</th>
                    <th className="whitespace-nowrap px-5 py-3 font-medium tabular-nums">Compra</th>
                    <th className="whitespace-nowrap px-5 py-3 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {rows.map((r) => (
                    <tr
                      key={r.subscriptionId}
                      data-testid={`admin-row-${r.subscriptionId}`}
                    >
                      <td className="whitespace-nowrap px-5 py-3 text-zinc-900">{r.email}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-zinc-700">
                        {r.fullName ?? '—'}
                      </td>
                      <td
                        className="whitespace-nowrap px-5 py-3 text-zinc-700"
                        data-testid={`admin-row-${r.subscriptionId}-plan`}
                      >
                        {r.planType === 'ANGELA_TOTAL' ? 'Total' : 'Esencial'}
                      </td>
                      <td
                        className="whitespace-nowrap px-5 py-3 text-zinc-700"
                        data-testid={`admin-row-${r.subscriptionId}-cadence`}
                      >
                        {r.cadence ? cadenceLabel(r.cadence as BillingCadence) : '—'}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_TONE[r.status] ?? 'bg-zinc-100 text-zinc-700 ring-zinc-200'}`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 tabular-nums text-zinc-700">
                        {formatPesos(r.amountPaidCentavos)}
                      </td>
                      <td
                        className="whitespace-nowrap px-5 py-3 tabular-nums text-zinc-500"
                        data-testid={`admin-row-${r.subscriptionId}-renewal`}
                      >
                        {formatRenewal(r.currentPeriodEnd)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 tabular-nums text-zinc-500">
                        {formatDate(r.purchaseDate ?? r.createdAt)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-zinc-500">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/admin/registrations/${r.subscriptionId}`}
                            data-testid={`admin-row-${r.subscriptionId}-detail`}
                            className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200 transition-colors hover:bg-zinc-50"
                          >
                            Ver detalle
                            <LuArrowRight aria-hidden className="h-3 w-3" />
                          </Link>
                          {!r.hasPairedDevice && r.status === 'ACTIVE' && (
                            <Link
                              href={`/admin/dispatch?focus=${r.subscriptionId}`}
                              data-testid={`admin-row-${r.subscriptionId}-pair`}
                              className="inline-flex items-center gap-1 rounded-full bg-sensu-50 px-3 py-1 text-xs font-medium text-sensu-700 ring-1 ring-sensu-200 transition-colors hover:bg-sensu-100"
                            >
                              <LuLink2 aria-hidden className="h-3 w-3" />
                              Asignar IMEI
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationNav
              currentPage={page}
              totalPages={totalPages}
              totalRows={totalRows}
              pageSize={PAGE_SIZE}
              baseHref={baseHref}
              testIdPrefix="admin-registrations-pagination"
              position="bottom"
            />
            </>
          )}
        </section>
      </div>
    </main>
  );
}
