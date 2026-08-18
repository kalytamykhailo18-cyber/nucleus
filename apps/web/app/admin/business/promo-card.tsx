'use client';

import type { PromoPayload } from '@/lib/admin-business';

function formatMxn(value: number): string {
  return `$${value.toLocaleString('es-MX')}`;
}

export function PromoCard({
  payload,
}: {
  payload: PromoPayload;
}): React.ReactElement {
  if (payload.rows.length === 0) {
    return (
      <div
        data-testid="business-card-promo-content"
        className="flex h-32 items-center justify-center text-xs text-zinc-400"
      >
        Aún no hay códigos promocionales activos.
      </div>
    );
  }

  const maxRedemptions = Math.max(
    1,
    ...payload.rows.map((r) => r.redemptions),
  );

  return (
    <div
      data-testid="business-card-promo-content"
      className="flex flex-col gap-6"
    >
      <dl className="grid grid-cols-3 gap-4 border-b border-zinc-100 pb-4 text-xs">
        <div>
          <dt className="uppercase tracking-wider text-zinc-500">Redenciones</dt>
          <dd
            data-testid="business-promo-total-redemptions"
            className="mt-1 text-xl font-semibold text-zinc-900 tabular-nums"
          >
            {payload.totalRedemptions.toLocaleString('es-MX')}
          </dd>
        </div>
        <div>
          <dt className="uppercase tracking-wider text-zinc-500">Ingresos brutos</dt>
          <dd className="mt-1 text-xl font-semibold text-zinc-900 tabular-nums">
            {formatMxn(payload.totalGrossRevenue)}
          </dd>
        </div>
        <div>
          <dt className="uppercase tracking-wider text-zinc-500">Descontado</dt>
          <dd className="mt-1 text-xl font-semibold text-rose-700 tabular-nums">
            {formatMxn(payload.totalMxnDiscounted)}
          </dd>
        </div>
      </dl>

      <div data-testid="business-promo-list" className="flex flex-col gap-3">
        {payload.rows.slice(0, 12).map((row) => {
          const pct = (row.redemptions / maxRedemptions) * 100;
          return (
            <div
              key={row.code}
              data-testid={`business-promo-row-${row.code}`}
              className="flex flex-col gap-1"
            >
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <div className="flex min-w-0 flex-1 items-baseline gap-2">
                  <span className="font-semibold text-zinc-900">
                    {row.code}
                  </span>
                  <span className="truncate text-zinc-500">
                    {row.label}
                  </span>
                </div>
                <div className="flex items-baseline gap-4 tabular-nums">
                  <span className="text-zinc-500">
                    {row.redemptions.toLocaleString('es-MX')} usos
                  </span>
                  <span className="font-semibold text-zinc-900">
                    {formatMxn(row.netRevenue)}
                  </span>
                </div>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
                <div
                  className="h-full rounded-full bg-sensu-500 transition-[width] duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
