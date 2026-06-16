import { LuBuilding2 } from 'react-icons/lu';
import { SectionLabel } from '@/components/section-label';
import { requireAdmin } from '@/lib/admin';
import { fetchCompanies } from '@/lib/companies';
import { AdminCompaniesClient } from './admin-companies-client';

export const dynamic = 'force-dynamic';

export default async function AdminCompaniesPage(): Promise<React.ReactElement> {
  await requireAdmin();
  const companies = await fetchCompanies();

  return (
    <main
      data-testid="admin-companies-page"
      className="flex flex-1 flex-col items-center px-6 pt-12 pb-12"
    >
      <div className="w-full max-w-4xl">
        <SectionLabel icon={LuBuilding2} tone="sensu">
          Administración · Empresas
        </SectionLabel>
        <h1 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900">
          Empresas B2B
        </h1>
        <p className="mt-3 text-base text-zinc-500">
          Clientes empresariales (manufactura, lone-worker, asistencia
          médica corporativa). Cada empresa agrupa a sus administradores
          (RR. HH. / Seguridad) y a los trabajadores que portan el
          dispositivo.
        </p>

        <AdminCompaniesClient initialCompanies={companies} />
      </div>
    </main>
  );
}
