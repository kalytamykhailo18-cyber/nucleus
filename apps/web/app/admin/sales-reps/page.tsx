import { LuUsersRound } from 'react-icons/lu';
import { SectionLabel } from '@/components/section-label';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/admin';
import { AdminSalesRepsClient } from './admin-sales-reps-client';

export const dynamic = 'force-dynamic';

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
export default async function AdminSalesRepsPage(): Promise<React.ReactElement> {
  await requireAdmin();
  const reps = await prisma.salesRep.findMany({
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
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

        <AdminSalesRepsClient initialReps={reps} />
      </div>
    </main>
  );
}
