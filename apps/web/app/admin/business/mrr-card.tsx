'use client';

import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { LuTrendingDown, LuTrendingUp } from 'react-icons/lu';
import type { MrrPayload } from '@/lib/admin-business';

function formatMxn(value: number): string {
  return `$${value.toLocaleString('es-MX')}`;
}

function shortMonthLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString('es-MX', {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  });
}

export function MrrCard({
  payload,
}: {
  payload: MrrPayload;
}): React.ReactElement {
  const chartData = useMemo(
    () =>
      payload.series.map((p) => ({
        month: shortMonthLabel(p.monthStart),
        mrr: p.mrrMxn,
      })),
    [payload.series],
  );

  const delta = payload.deltaPct;
  const positive = delta !== null && delta >= 0;
  const noComparison = delta === null;

  return (
    <div
      data-testid="business-card-mrr-content"
      className="grid gap-6 sm:grid-cols-3"
    >
      <div className="sm:col-span-1">
        <p
          data-testid="business-mrr-value"
          className="text-3xl font-semibold tracking-tight text-zinc-900 tabular-nums"
        >
          {formatMxn(payload.currentMonthMxn)}
        </p>
        <p className="mt-1 text-xs uppercase tracking-wider text-zinc-500">
          MRR este mes
        </p>
        {!noComparison && (
          <div
            data-testid="business-mrr-delta"
            className={`mt-4 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
              positive
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-rose-50 text-rose-700'
            }`}
          >
            {positive ? (
              <LuTrendingUp aria-hidden className="h-3.5 w-3.5" />
            ) : (
              <LuTrendingDown aria-hidden className="h-3.5 w-3.5" />
            )}
            <span>
              {positive ? '+' : ''}
              {delta.toFixed(1)}% vs. mes anterior
            </span>
          </div>
        )}
        {noComparison && (
          <p className="mt-4 text-xs text-zinc-400">
            Sin datos del mes anterior para comparar.
          </p>
        )}
      </div>

      <div
        data-testid="business-mrr-chart"
        className="sm:col-span-2 h-56 w-full"
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="mrrFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ff5757" stopOpacity={0.32} />
                <stop offset="100%" stopColor="#ff5757" stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#f4f4f5" vertical={false} />
            <XAxis
              dataKey="month"
              stroke="#a1a1aa"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              stroke="#a1a1aa"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) =>
                v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`
              }
              width={44}
            />
            <Tooltip
              cursor={{ stroke: '#e4e4e7', strokeWidth: 1 }}
              contentStyle={{
                borderRadius: 12,
                border: '1px solid #e4e4e7',
                fontSize: 12,
                boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
              }}
              formatter={(value) => [
                typeof value === 'number' ? formatMxn(value) : String(value),
                'MRR',
              ]}
              labelStyle={{ color: '#71717a', fontSize: 11 }}
            />
            <Area
              type="monotone"
              dataKey="mrr"
              stroke="#ff5757"
              strokeWidth={2}
              fill="url(#mrrFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
