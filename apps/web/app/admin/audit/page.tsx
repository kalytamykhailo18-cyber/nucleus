import Link from 'next/link';
import { LuClipboardList, LuFilter, LuUser } from 'react-icons/lu';
import { SectionLabel } from '@/components/section-label';
import { PaginationNav } from '@/components/pagination-nav';
import { requireAdmin } from '@/lib/admin';
import { fetchAdminAuditLog } from '@/lib/admin-audit';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

/**
 * /admin/audit — admin-action audit trail (Phase C #4, 2026-06-15).
 *
 * Read-only ledger of every mutation we wired through `logAdminAction`.
 * Filters: action prefix (e.g. "company"), actor email, target type +
 * id. Pagination at 20 rows (dropped from 50 on 2026-08-26 after each
 * row's expanded metadata pushed the page past 10 screen heights).
 * Metadata now collapses into a `<details>` so a page of 20 rows fits
 * inside one screen unless the operator opens each row deliberately.
 * No write endpoints; the log is append-only by design.
 */
export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}): Promise<React.ReactElement> {
  await requireAdmin();
  const params = await searchParams;
  const page = Math.max(parseInt(params.page ?? '1', 10) || 1, 1);

  const { rows, total, pageSize } = await fetchAdminAuditLog({
    page,
    pageSize: PAGE_SIZE,
    actorEmail: params.actor,
    action: params.action,
    targetType: params.target_type,
    targetId: params.target_id,
  });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const baseQs = new URLSearchParams();
  if (params.actor) baseQs.set('actor', params.actor);
  if (params.action) baseQs.set('action', params.action);
  if (params.target_type) baseQs.set('target_type', params.target_type);
  if (params.target_id) baseQs.set('target_id', params.target_id);
  const baseHref = baseQs.size
    ? `/admin/audit?${baseQs.toString()}`
    : '/admin/audit';

  return (
    <main
      data-testid="admin-audit-page"
      className="flex flex-1 flex-col items-center px-6 pt-12 pb-12"
    >
      <div className="w-full max-w-5xl">
        <SectionLabel icon={LuClipboardList} tone="sensu">
          Administración · Auditoría
        </SectionLabel>
        <h1 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900">
          Registro de acciones
        </h1>
        <p className="mt-3 text-base text-zinc-500">
          Cada cambio que un administrador hace queda registrado aquí
          (crear empresa, editar contactos compartidos, marcar envío,
          activar dispositivo, etc.). Solo lectura, ordenado del más
          reciente al más antiguo.
        </p>

        <form
          method="GET"
          data-testid="admin-audit-filters"
          className="card-surface mt-8 grid grid-cols-1 gap-3 rounded-3xl p-5 sm:grid-cols-4"
        >
          <Field name="actor" label="Email del admin" placeholder="ustym@" defaultValue={params.actor} />
          <Field name="action" label="Acción" placeholder="company.create" defaultValue={params.action} />
          <Field name="target_type" label="Tipo de objeto" placeholder="Company" defaultValue={params.target_type} />
          <Field name="target_id" label="ID del objeto" placeholder="cmqb…" defaultValue={params.target_id} />
          <div className="sm:col-span-4 flex items-center justify-between">
            <p className="text-xs text-zinc-500">
              <LuFilter aria-hidden className="mr-1 inline h-3 w-3" />
              {total.toLocaleString('es-MX')} entradas {Object.values(params).some(Boolean) ? 'tras filtro' : 'totales'}
            </p>
            <div className="flex items-center gap-2">
              <Link
                href="/admin/audit"
                data-testid="admin-audit-clear"
                className="text-xs text-zinc-500 hover:text-zinc-900"
              >
                Limpiar
              </Link>
              <button
                type="submit"
                data-testid="admin-audit-apply"
                className="inline-flex h-9 items-center rounded-full bg-sensu-500 px-4 text-xs font-medium text-white transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
              >
                Aplicar filtros
              </button>
            </div>
          </div>
        </form>

        {rows.length === 0 ? (
          <p
            data-testid="admin-audit-empty"
            className="card-surface mt-6 rounded-3xl px-6 py-10 text-center text-sm text-zinc-500"
          >
            Sin entradas en el registro con esos filtros.
          </p>
        ) : (
          <>
          {totalPages > 1 && (
            <div className="mt-6 flex justify-center">
              <PaginationNav
                currentPage={page}
                totalPages={totalPages}
                totalRows={total}
                pageSize={pageSize}
                baseHref={baseHref}
                testIdPrefix="admin-audit-pagination"
                position="top"
              />
            </div>
          )}
            <ul
            data-testid="admin-audit-list"
            className="mt-6 space-y-2"
          >
            {rows.map((r) => (
              <li
                key={r.id}
                data-testid={`admin-audit-row-${r.id}`}
                className="card-surface rounded-2xl px-5 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium text-zinc-900">
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-mono text-zinc-700 ring-1 ring-zinc-200">
                        {r.action}
                      </span>
                      {r.targetType && (
                        <span className="text-xs text-zinc-500">
                          → {r.targetType}
                          {r.targetId ? ` · ${r.targetId}` : ''}
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      <LuUser aria-hidden className="mr-1 inline h-3 w-3" />
                      {r.actorEmail ?? 'system'} ·{' '}
                      {new Date(r.createdAt).toLocaleString('es-MX', {
                        timeZone: 'America/Mexico_City',
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
                {r.metadata !== null && r.metadata !== undefined && (
                  <details
                    data-testid={`admin-audit-row-${r.id}-metadata-toggle`}
                    className="group mt-2"
                  >
                    <summary className="cursor-pointer select-none text-[11px] text-zinc-500 hover:text-zinc-800 group-open:text-zinc-800">
                      Ver payload
                    </summary>
                    <pre
                      data-testid={`admin-audit-row-${r.id}-metadata`}
                      className="mt-2 max-h-64 overflow-auto rounded-xl bg-zinc-50 p-3 text-[11px] leading-snug text-zinc-700 ring-1 ring-zinc-100 font-mono"
                    >
                      {JSON.stringify(r.metadata, null, 2)}
                    </pre>
                  </details>
                )}
              </li>
            ))}
          </ul>
          {totalPages > 1 && (
            <div className="mt-6 flex justify-center">
              <PaginationNav
                currentPage={page}
                totalPages={totalPages}
                totalRows={total}
                pageSize={pageSize}
                baseHref={baseHref}
                testIdPrefix="admin-audit-pagination"
                position="bottom"
              />
            </div>
          )}
          </>
        )}
      </div>
    </main>
  );
}

function Field({
  name,
  label,
  placeholder,
  defaultValue,
}: {
  name: string;
  label: string;
  placeholder: string;
  defaultValue?: string;
}): React.ReactElement {
  return (
    <label className="flex flex-col gap-1.5 text-xs text-zinc-600">
      <span>{label}</span>
      <input
        type="text"
        name={name}
        defaultValue={defaultValue ?? ''}
        placeholder={placeholder}
        data-testid={`admin-audit-input-${name}`}
        className="h-9 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300/60"
      />
    </label>
  );
}
