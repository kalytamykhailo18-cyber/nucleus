import Link from 'next/link';
import { LuBuilding2, LuFilter, LuFilterX } from 'react-icons/lu';
import { SectionLabel } from '@/components/section-label';
import { PaginationNav } from '@/components/pagination-nav';
import { requireAdmin } from '@/lib/admin';
import { fetchCompanies } from '@/lib/companies';
import { resolveStrictAdminView } from '@/lib/admin-view';
import { AdminCompaniesClient } from './admin-companies-client';

export const dynamic = 'force-dynamic';

export default async function AdminCompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; page?: string }>;
}): Promise<React.ReactElement> {
  await requireAdmin();
  const params = await searchParams;
  // Juan 2026-06-23 follow-up: strict is the DEFAULT — see
  // resolveStrictAdminView. Playwright sessions get the opt-out
  // cookie so the spec suite still sees seeded demo rows.
  const strictView = await resolveStrictAdminView(params.vista);
  const pageNum = (() => {
    const n = Number(params.page);
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
  })();
  const companies = await fetchCompanies({
    strict: strictView,
    page: pageNum,
    pageSize: 25,
  });

  return (
    <main
      data-testid="admin-companies-page"
      className="flex flex-1 flex-col items-center px-6 pt-12 pb-12"
    >
      <div className="w-full max-w-4xl">
        <SectionLabel icon={LuBuilding2} tone="sensu">
          Administración · Empresas
        </SectionLabel>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900">
            Empresas B2B
          </h1>
          <Link
            href={
              strictView ? '/admin/companies?vista=all' : '/admin/companies'
            }
            data-testid="admin-companies-real-toggle"
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
        </div>
        <p className="mt-3 text-base text-zinc-500">
          Clientes empresariales (manufactura, lone-worker, asistencia
          médica corporativa). Cada empresa agrupa a sus administradores
          (RR. HH. / Seguridad) y a los trabajadores que portan el
          dispositivo.
        </p>

        {companies.totalPages > 1 && (
          <div className="mt-6">
            <PaginationNav
              currentPage={companies.page}
              totalPages={companies.totalPages}
              totalRows={companies.totalRows}
              pageSize={companies.pageSize}
              baseHref={`/admin/companies${strictView ? '' : '?vista=all'}`}
              testIdPrefix="admin-companies-pagination"
              position="top"
            />
          </div>
        )}

        <AdminCompaniesClient initialCompanies={companies.rows} />

        {companies.totalPages > 1 && (
          <div className="mt-6">
            <PaginationNav
              currentPage={companies.page}
              totalPages={companies.totalPages}
              totalRows={companies.totalRows}
              pageSize={companies.pageSize}
              baseHref={`/admin/companies${strictView ? '' : '?vista=all'}`}
              testIdPrefix="admin-companies-pagination"
              position="bottom"
            />
          </div>
        )}
      </div>
    </main>
  );
}
