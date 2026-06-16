import { LuTruck } from 'react-icons/lu';
import { SectionLabel } from '@/components/section-label';
import { requireAdmin } from '@/lib/admin';
import {
  fetchAwaitingShipment,
  fetchAwaitingActivation,
} from '@/lib/dispatch';
import { AdminDispatchClient } from './admin-dispatch-client';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

function parsePage(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export default async function AdminDispatchPage({
  searchParams,
}: {
  searchParams: Promise<{ envio_page?: string; act_page?: string; focus?: string }>;
}): Promise<React.ReactElement> {
  await requireAdmin();
  const params = await searchParams;
  const shippingPage = parsePage(params.envio_page);
  const activatingPage = parsePage(params.act_page);
  // Cross-link target from /admin/registrations → scroll-to + highlight
  // + auto-open the Emparejar modal for this subscription. See Phase C #1.
  const focusSubscriptionId = params.focus ?? null;
  const [shipping, activating] = await Promise.all([
    fetchAwaitingShipment(shippingPage, PAGE_SIZE),
    fetchAwaitingActivation(activatingPage, PAGE_SIZE),
  ]);

  // Single base href shared by both queue navs; each nav writes its own
  // page param so the other queue's position is preserved across clicks.
  const baseHref = `/admin/dispatch?envio_page=${shipping.page}&act_page=${activating.page}`;

  return (
    <main
      data-testid="admin-dispatch-page"
      className="flex flex-1 flex-col items-center px-6 pt-12 pb-12"
    >
      <div className="w-full max-w-4xl">
        <SectionLabel icon={LuTruck} tone="sensu">
          Administración · Despacho
        </SectionLabel>
        <h1 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900">
          Despacho del call-center
        </h1>
        <p className="mt-3 text-base text-zinc-500">
          Dos colas: registros pagados que esperan envío de su Angela, y
          Angelas entregadas que esperan vinculación con un IMEI. Cada
          acción dispara el correo correspondiente al titular.
        </p>

        <AdminDispatchClient
          initialShipping={shipping.rows}
          initialActivating={activating.rows}
          focusSubscriptionId={focusSubscriptionId}
          shippingPagination={{
            currentPage: shipping.page,
            totalPages: shipping.totalPages,
            totalRows: shipping.totalRows,
            pageSize: shipping.pageSize,
            baseHref,
            pageParam: 'envio_page',
          }}
          activatingPagination={{
            currentPage: activating.page,
            totalPages: activating.totalPages,
            totalRows: activating.totalRows,
            pageSize: activating.pageSize,
            baseHref,
            pageParam: 'act_page',
          }}
        />
      </div>
    </main>
  );
}
