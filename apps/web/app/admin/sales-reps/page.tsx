import { LuUsersRound } from 'react-icons/lu';
import { SectionLabel } from '@/components/section-label';
import { PaginationNav } from '@/components/pagination-nav';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/admin';
import { AdminSalesRepsClient } from './admin-sales-reps-client';

export const dynamic = 'force-dynamic';

// Ustym 2026-08-26: paginate at 25 per page. Sales-rep table is small
// today (< 20 reps), but the rule is prevent-not-react — this is on
// the list of surfaces that must stay short even as the rep base
// grows into the dozens. Top+bottom nav enforced.
const PAGE_SIZE = 25;

/**
 * Sales-rep roster + commission attribution panel (Juan 2026-07-30
 * direct-sales pivot). Admin creates reps here with a stable slug;
 * that slug shows up in the rep's public checkout link
 * `https://app.sensu.com.mx/checkout?plan=ANGELA_ESENCIAL&option=A&rep=<slug>`
 * and every signup that arrives with a matching active slug lands
 * attributed to the rep for commission reporting.
 *
 * Deactivating a rep stops new attributions but preserves historical
 * ones on Subscription rows so commission runs stay stable.
 */
export default async function AdminSalesRepsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}): Promise<React.ReactElement> {
  await requireAdmin();
  const sp = await searchParams;
  const requestedPage = Math.max(parseInt(sp.page ?? '1', 10) || 1, 1);
  const totalRows = await prisma.salesRep.count();
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const safePage = Math.min(requestedPage, totalPages);
  const reps = await prisma.salesRep.findMany({
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
    take: PAGE_SIZE,
    skip: (safePage - 1) * PAGE_SIZE,
    select: {
      id: true,
      slug: true,
      name: true,
      email: true,
      phone: true,
      commissionBps: true,
      active: true,
      notes: true,
      createdAt: true,
      _count: { select: { subscriptions: true } },
    },
  });

  return (
    <main
      data-testid="admin-sales-reps-page"
      className="flex flex-1 flex-col items-center px-6 pt-12 pb-12"
    >
      <div className="w-full max-w-4xl">
        <SectionLabel icon={LuUsersRound} tone="sensu">
          Administración · Vendedores
        </SectionLabel>
        <h1 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900">
          Vendedores y comisiones
        </h1>
        <p className="mt-3 text-base text-zinc-500">
          Cada vendedor recibe un enlace de venta personal.
          Cuando un cliente entra por ese enlace y contrata, la venta
          queda registrada al vendedor para calcular su comisión.
          Al desactivar un vendedor, sus ventas anteriores se conservan y
          su enlace deja de asignar nuevas ventas.
        </p>

        {totalPages > 1 && (
          <div className="mt-6 flex justify-center">
            <PaginationNav
              currentPage={safePage}
              totalPages={totalPages}
              totalRows={totalRows}
              pageSize={PAGE_SIZE}
              baseHref="/admin/sales-reps"
              testIdPrefix="admin-sales-reps-pagination"
              position="top"
            />
          </div>
        )}

        <AdminSalesRepsClient initialReps={reps} />

        {totalPages > 1 && (
          <div className="mt-6 flex justify-center">
            <PaginationNav
              currentPage={safePage}
              totalPages={totalPages}
              totalRows={totalRows}
              pageSize={PAGE_SIZE}
              baseHref="/admin/sales-reps"
              testIdPrefix="admin-sales-reps-pagination"
              position="bottom"
            />
          </div>
        )}
      </div>
    </main>
  );
}
