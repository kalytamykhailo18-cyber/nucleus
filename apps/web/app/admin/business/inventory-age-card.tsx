'use client';

import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AgeBucketKey, InventoryAgePayload } from '@/lib/admin-business';

// Gradient from fresh emerald to abandoned rose so the health of the
// fleet is visually obvious at a glance.
const BUCKET_COLOR: Record<AgeBucketKey, string> = {
  '<1h': '#10b981', // emerald-500
  '1-24h': '#22c55e', // green-500
  '1-7d': '#84cc16', // lime-500
  '7-30d': '#eab308', // yellow-500
  '>30d': '#f97316', // orange-500
  never: '#f43f5e', // rose-500
};

export function InventoryAgeCard({
  payload,
}: {
  payload: InventoryAgePayload;
}): React.ReactElement {
  if (payload.totalActive === 0) {
    return (
      <div
        data-testid="business-card-inventory-age-content"
        className="flex h-40 items-center justify-center text-xs text-zinc-400"
      >
        No hay dispositivos activos aún.
      </div>
    );
  }

  const data = payload.buckets.map((b) => ({
    label: b.label,
    n: b.n,
    fill: BUCKET_COLOR[b.bucket],
    bucket: b.bucket,
  }));

  return (
    <div
      data-testid="business-card-inventory-age-content"
      className="flex flex-col gap-3"
    >
      <div className="text-xs uppercase tracking-wider text-zinc-500">
        <span
          data-testid="business-inventory-total"
          className="text-lg font-semibold text-zinc-900 tabular-nums"
        >
          {payload.totalActive}
        </span>{' '}
        dispositivos activos
      </div>

      <div
        data-testid="business-inventory-chart"
        className="h-44 w-full"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 20, right: 8, left: 0, bottom: 4 }}
          >
            <XAxis
              dataKey="label"
              stroke="#a1a1aa"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              interval={0}
              angle={-15}
              dy={8}
              height={40}
            />
            <YAxis
              stroke="#a1a1aa"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              width={28}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ fill: '#f4f4f5' }}
              contentStyle={{
                borderRadius: 12,
                border: '1px solid #e4e4e7',
                fontSize: 12,
                boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
              }}
              formatter={(value) => [String(value), 'Dispositivos']}
              labelStyle={{ color: '#71717a', fontSize: 11 }}
            />
            <Bar dataKey="n" radius={[6, 6, 0, 0]}>
              {data.map((row) => (
                <Cell key={row.bucket} fill={row.fill} />
              ))}
              <LabelList
                dataKey="n"
                position="top"
                style={{ fill: '#3f3f46', fontSize: 11, fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
