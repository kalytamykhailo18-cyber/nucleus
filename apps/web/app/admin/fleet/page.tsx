import Link from 'next/link';
import {
  LuBattery,
  LuFilter,
  LuFilterX,
  LuMap,
  LuMapPin,
  LuPackage,
} from 'react-icons/lu';
import { PaginationNav } from '@/components/pagination-nav';
import { SectionLabel } from '@/components/section-label';
import { requireCallcenterOrAdmin } from '@/lib/admin';
import { fetchFleetDevices, type FleetDevice } from '@/lib/fleet-map';
import { resolveStrictAdminView } from '@/lib/admin-view';
import { FleetMapLoader } from './fleet-map-loader';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

function paginate<T>(rows: T[], requested: number): {
  totalRows: number;
  totalPages: number;
  safePage: number;
  pageItems: T[];
} {
  const totalRows = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, requested), totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  return {
    totalRows,
    totalPages,
    safePage,
    pageItems: rows.slice(start, start + PAGE_SIZE),
  };
}

export default async function AdminFleetPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; invPage?: string; vista?: string }>;
}): Promise<React.ReactElement> {
  const admin = await requireCallcenterOrAdmin();
  const params = await searchParams;
  const parsePage = (raw: string | undefined): number => {
    const n = Number(raw);
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
  };

  // Juan 2026-06-23 follow-up: strict is the DEFAULT — see
  // resolveStrictAdminView. Playwright sessions get the opt-out
  // cookie so the spec suite still sees the EV-* synthetic IMEIs.
  const strictView = await resolveStrictAdminView(params.vista);
  const devices = await fetchFleetDevices({
    callcenterMode: admin.callcenterMode || strictView,
  });

  // Three buckets:
  //   1. on the map (has GPS fix) — drives FleetMapClient
  //   2. assigned but no fix (MASTER linked, customer-owned, waiting on
  //      first GPS report)
  //   3. unassigned inventory (no MASTER) — the bucket the 20 new B2B
  //      IMEIs landed into on 2026-05-28. Sorted createdAt desc so the
  //      freshest batch lands at the top for Operations.
  const unfixed = devices.filter(
    (d): d is FleetDevice => d.lat === null || d.lng === null,
  );
  const assignedNoFix = unfixed.filter((d) => d.masterName !== null);
  const inventory = unfixed
    .filter((d) => d.masterName === null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const assignedPage = paginate(assignedNoFix, parsePage(params.page));
  const inventoryPage = paginate(inventory, parsePage(params.invPage));

  return (
    <main
      data-testid="admin-fleet-page"
      className="flex flex-1 flex-col items-center px-6 pt-12 pb-12"
    >
      <div className="w-full max-w-5xl">
        <SectionLabel icon={LuMap} tone="sensu">
          Administración · Mapa de la flota
        </SectionLabel>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900">
            Mapa de la flota
          </h1>
          {admin.role === 'ADMIN' && (
            <Link
              href={
                strictView ? '/admin/fleet?vista=all' : '/admin/fleet'
              }
              data-testid="admin-fleet-real-toggle"
              className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium transition-transform hover:-translate-y-0.5 active:scale-[0.98] ${
                strictView
                  ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200'
                  : 'bg-white text-zinc-700 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50'
              }`}
            >
              {strictView ? (
                <>
                  <LuFilterX aria-hidden className="h-4 w-4" />
                  Mostrar datos de prueba
                </>
              ) : (
                <>
                  <LuFilter aria-hidden className="h-4 w-4" />
                  Solo clientes reales
                </>
              )}
            </Link>
          )}
        </div>
        <p className="mt-3 text-base text-zinc-500">
          Cada Angela activa aparece como un pin con su última ubicación
          conocida. El operador usa la cola de prioridades para triar las
          emergencias y abre este mapa cuando necesita una vista panorámica
          (cobertura por región, conglomerados, un adulto mayor que viaja).
        </p>

        <FleetMapLoader devices={devices} />

        {assignedPage.totalRows > 0 && (
          <section
            data-testid="admin-fleet-no-fix"
            className="mt-6 rounded-3xl bg-white p-4 ring-1 ring-zinc-200"
          >
            <header className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-zinc-500">
                  <LuMapPin className="h-4 w-4 text-zinc-400" />
                  Asignados sin contacto
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Angelas ya entregadas a un titular pero que todavía no han
                  reportado GPS. Aparecen en el mapa apenas envíen su primera
                  ubicación.
                </p>
              </div>
              <p
                data-testid="admin-fleet-no-fix-count"
                className="text-xs text-zinc-500 tabular-nums"
              >
                {assignedPage.totalRows.toLocaleString('es-MX')} sin contacto
              </p>
            </header>

            <PaginationNav
              currentPage={assignedPage.safePage}
              totalPages={assignedPage.totalPages}
              totalRows={assignedPage.totalRows}
              pageSize={PAGE_SIZE}
              baseHref="/admin/fleet"
              testIdPrefix="admin-fleet-no-fix-pagination"
              position="top"
            />

            <ul className="mt-3 grid gap-2">
              {assignedPage.pageItems.map((d) => (
                <li
                  key={d.deviceId}
                  data-testid={`fleet-no-fix-${d.deviceId}`}
                  className="flex items-center gap-3 rounded-2xl bg-zinc-50 px-3 py-2 text-sm text-zinc-700 ring-1 ring-zinc-200/70"
                >
                  <span className="flex-1 truncate font-medium text-zinc-900">
                    {d.deviceName ?? d.deviceId}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {d.masterName}
                  </span>
                  {d.batteryLevel !== null ? (
                    <span className="inline-flex items-center gap-1 text-xs text-zinc-500 tabular-nums">
                      <LuBattery className="h-3 w-3" />
                      {d.batteryLevel}%
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>

            <PaginationNav
              currentPage={assignedPage.safePage}
              totalPages={assignedPage.totalPages}
              totalRows={assignedPage.totalRows}
              pageSize={PAGE_SIZE}
              baseHref="/admin/fleet"
              testIdPrefix="admin-fleet-no-fix-pagination"
              position="bottom"
            />
          </section>
        )}

        {inventoryPage.totalRows > 0 && (
          <section
            data-testid="admin-fleet-inventory"
            className="mt-6 rounded-3xl bg-white p-4 ring-1 ring-zinc-200"
          >
            <header className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-zinc-500">
                  <LuPackage className="h-4 w-4 text-amber-500" />
                  Inventario sin asignar
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  IMEIs cargados en el inventario pero sin titular todavía —
                  el lote B2B más reciente aparece arriba. Listos para enlazar
                  con la cuenta de un trabajador o de una familia.
                </p>
              </div>
              <p
                data-testid="admin-fleet-inventory-count"
                className="text-xs text-zinc-500 tabular-nums"
              >
                {inventoryPage.totalRows.toLocaleString('es-MX')} en inventario
              </p>
            </header>

            <PaginationNav
              currentPage={inventoryPage.safePage}
              totalPages={inventoryPage.totalPages}
              totalRows={inventoryPage.totalRows}
              pageSize={PAGE_SIZE}
              baseHref="/admin/fleet"
              pageParam="invPage"
              testIdPrefix="admin-fleet-inventory-pagination"
              position="top"
            />

            <ul className="mt-3 grid gap-2">
              {inventoryPage.pageItems.map((d) => (
                <li
                  key={d.deviceId}
                  data-testid={`fleet-inventory-${d.deviceId}`}
                  className="flex items-center gap-3 rounded-2xl bg-amber-50/60 px-3 py-2 text-sm text-zinc-700 ring-1 ring-amber-100"
                >
                  <span className="flex-1 truncate font-medium text-zinc-900">
                    {d.deviceName ?? d.deviceId}
                  </span>
                  <span className="text-xs text-amber-700">
                    Sin titular
                  </span>
                  <time
                    dateTime={d.createdAt}
                    className="text-xs text-zinc-500 tabular-nums"
                  >
                    {new Date(d.createdAt).toLocaleDateString('es-MX', {
                      year: 'numeric',
                      month: 'short',
                      day: '2-digit',
                    })}
                  </time>
                </li>
              ))}
            </ul>

            <PaginationNav
              currentPage={inventoryPage.safePage}
              totalPages={inventoryPage.totalPages}
              totalRows={inventoryPage.totalRows}
              pageSize={PAGE_SIZE}
              baseHref="/admin/fleet"
              pageParam="invPage"
              testIdPrefix="admin-fleet-inventory-pagination"
              position="bottom"
            />
          </section>
        )}
      </div>
    </main>
  );
}
