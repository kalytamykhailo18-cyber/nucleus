'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ChurnPayload } from '@/lib/admin-business';

export function ChurnCard({
  payload,
}: {
  payload: ChurnPayload;
}): React.ReactElement {
  const data = [
    { label: 'Activos', value: payload.active, color: '#10b981' },
    {
      label: 'Cancelados',
      value: payload.churnedThisMonth,
      color: '#f43f5e',
    },
  ];

  const rateLabel = `${payload.churnRatePct.toFixed(1)}%`;
  const netPositive = payload.netChange >= 0;

  return (
    <div
      data-testid="business-card-active-churned-content"
      className="flex flex-col gap-5"
    >
      <div
        data-testid="business-churn-chart"
        className="h-40 w-full"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 20, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid stroke="#f4f4f5" vertical={false} />
            <XAxis
              dataKey="label"
              stroke="#a1a1aa"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#a1a1aa"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              width={30}
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
              formatter={(value) => [String(value), '']}
              labelStyle={{ color: '#71717a', fontSize: 11 }}
            />
            <Bar dataKey="value" radius={[8, 8, 0, 0]}>
              {data.map((row) => (
                <Cell key={row.label} fill={row.color} />
              ))}
              <LabelList
                dataKey="value"
                position="top"
                style={{ fill: '#3f3f46', fontSize: 12, fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <dl className="grid grid-cols-2 gap-3 border-t border-zinc-100 pt-4 text-xs">
        <div>
          <dt className="uppercase tracking-wider text-zinc-500">Tasa de cancelación</dt>
          <dd
            data-testid="business-churn-rate"
            className="mt-1 text-lg font-semibold text-zinc-900 tabular-nums"
          >
            {rateLabel}
          </dd>
        </div>
        <div>
          <dt className="uppercase tracking-wider text-zinc-500">Cambio neto</dt>
          <dd
            data-testid="business-churn-net"
            className={`mt-1 text-lg font-semibold tabular-nums ${
              netPositive ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {netPositive ? '+' : ''}
            {payload.netChange}
          </dd>
        </div>
      </dl>
    </div>
  );
}
