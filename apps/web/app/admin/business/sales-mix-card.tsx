'use client';

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { SalesMixPayload, SalesMixBucket } from '@/lib/admin-business';

const BUCKET_COLOR: Record<SalesMixBucket, string> = {
  assisted_sale: '#ff5757', // sensu coral (assisted sales = brand-tagged rail)
  referral: '#f59e0b', // amber-500
  partnership: '#8b5cf6', // violet-500
  self_serve: '#10b981', // emerald-500
};

export function SalesMixCard({
  payload,
}: {
  payload: SalesMixPayload;
}): React.ReactElement {
  const nonEmpty = payload.slices.filter((s) => s.subscriptionCount > 0);

  if (nonEmpty.length === 0) {
    return (
      <div
        data-testid="business-card-sales-mix-content"
        className="flex h-40 items-center justify-center text-xs text-zinc-400"
      >
        Sin ventas este mes.
      </div>
    );
  }

  const data = nonEmpty.map((s) => ({
    bucket: s.bucket,
    label: s.label,
    value: s.subscriptionCount,
    revenue: s.revenueMxn,
  }));

  return (
    <div
      data-testid="business-card-sales-mix-content"
      className="flex flex-col gap-3"
    >
      <div
        data-testid="business-sales-mix-chart"
        className="relative h-48 w-full"
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={44}
              outerRadius={72}
              paddingAngle={2}
              stroke="none"
            >
              {data.map((row) => (
                <Cell key={row.bucket} fill={BUCKET_COLOR[row.bucket]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: '1px solid #e4e4e7',
                fontSize: 12,
                boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
              }}
              formatter={(value, _n, item) => {
                const p = item?.payload as {
                  label?: string;
                  revenue?: number;
                };
                return [
                  `${value} · $${(p?.revenue ?? 0).toLocaleString('es-MX')}`,
                  p?.label ?? '',
                ];
              }}
            />
            <Legend
              iconType="circle"
              formatter={(v) => (
                <span className="text-xs text-zinc-600">{v}</span>
              )}
              wrapperStyle={{ fontSize: 11 }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span
            data-testid="business-sales-mix-total"
            className="text-2xl font-semibold text-zinc-900 tabular-nums"
          >
            {payload.totalSubscriptions}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">
            Ventas este mes
          </span>
        </div>
      </div>

      <ul className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-zinc-100 pt-3 text-xs">
        {nonEmpty.map((s) => (
          <li
            key={s.bucket}
            data-testid={`business-sales-mix-slice-${s.bucket}`}
            className="flex items-center gap-2"
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: BUCKET_COLOR[s.bucket] }}
              aria-hidden
            />
            <span className="truncate text-zinc-600">{s.label}</span>
            <span className="ml-auto font-semibold text-zinc-900 tabular-nums">
              {s.subscriptionCount}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
