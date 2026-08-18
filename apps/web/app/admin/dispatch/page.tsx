import Link from 'next/link';
import { LuFilter, LuFilterX, LuTruck } from 'react-icons/lu';
import { SectionLabel } from '@/components/section-label';
import { requireAdmin } from '@/lib/admin';
import { resolveStrictAdminView } from '@/lib/admin-view';
import {
  fetchAwaitingShipment,
  fetchAwaitingActivation,
  resolveDispatchFocusPage,
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
  searchParams: Promise<{ envio_page?: string; act_page?: string; focus?: string; vista?: string }>;
}): Promise<React.ReactElement> {
  const admin = await requireAdmin();
  const params = await searchParams;
  let shippingPage = parsePage(params.envio_page);
  let activatingPage = parsePage(params.act_page);
  // Cross-link target from /admin/registrations → scroll-to + highlight
  // + auto-open the Emparejar modal for this subscription. See Phase C #1.
  const focusSubscriptionId = params.focus ?? null;
  // Juan 2026-06-23 follow-up: strict is the DEFAULT — see
  // resolveStrictAdminView. Playwright sessions get the opt-out
  // cookie so the spec suite still sees seeded queue rows.
  const strictView = await resolveStrictAdminView(params.vista);
  const callcenterModeEffective = admin.callcenterMode || strictView;

  // 2026-06-24: pagination + cross-link interplay. When the admin
  // clicks Asignar IMEI on /admin/registrations, the URL is
  // `/admin/dispatch?focus=<subId>` with no page hint. Without this
  // lookup the page defaults to envio_page=1 / act_page=1 and the
  // focused row is usually paginated out. Resolve which queue + page
  // the row sits on and silently switch to it before fetching the
  // visible slice.
  if (focusSubscriptionId && !params.envio_page && !params.act_page) {
    const resolved = await resolveDispatchFocusPage(
      focusSubscriptionId,
      PAGE_SIZE,
      { callcenterMode: callcenterModeEffective },
    );
    if (resolved.queue === 'shipping') {
      shippingPage = resolved.page;
    } else if (resolved.queue === 'activation') {
      activatingPage = resolved.page;
    }
  }

  const [shipping, activating] = await Promise.all([
    fetchAwaitingShipment(shippingPage, PAGE_SIZE, {
      callcenterMode: callcenterModeEffective,
    }),
    fetchAwaitingActivation(activatingPage, PAGE_SIZE, {
      callcenterMode: callcenterModeEffective,
    }),
  ]);

  // Single base href shared by both queue navs; each nav writes its own
  // page param so the other queue's position is preserved across clicks.
  const vistaSuffix = strictView ? '' : '&vista=all';
  const baseHref = `/admin/dispatch?envio_page=${shipping.page}&act_page=${activating.page}${vistaSuffix}`;
  const toggleHref = strictView
    ? `/admin/dispatch?vista=all`
    : `/admin/dispatch`;

  return (
    <main
      data-testid="admin-dispatch-page"
      className="flex flex-1 flex-col items-center px-6 pt-12 pb-12"
    >
      <div className="w-full max-w-4xl">
        <SectionLabel icon={LuTruck} tone="sensu">
          Administración · Despacho
        </SectionLabel>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900">
            Despacho del call-center
          </h1>
          <Link
            href={toggleHref}
            data-testid="admin-dispatch-real-toggle"
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
