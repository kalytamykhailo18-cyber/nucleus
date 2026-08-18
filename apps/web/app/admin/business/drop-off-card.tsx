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
import type { DropOffPayload } from '@/lib/admin-business';

// Amber gradient — cool for the small drops, hot for the biggest ones,
// so the eye tracks priority.
const HEAT = ['#fef3c7', '#fde68a', '#fbbf24', '#f97316', '#dc2626'];

function colorForRank(rank: number, total: number): string {
  if (total <= 1) return HEAT[HEAT.length - 1]!;
  const t = rank / (total - 1);
  const idx = Math.min(
    HEAT.length - 1,
    Math.max(0, Math.round(t * (HEAT.length - 1))),
  );
  return HEAT[idx]!;
}

export function DropOffCard({
  payload,
}: {
  payload: DropOffPayload;
}): React.ReactElement {
  if (payload.totalIncomplete === 0) {
    return (
      <div
        data-testid="business-card-drop-off-content"
        className="flex h-40 items-center justify-center text-xs text-zinc-400"
      >
        No hay flujos incompletos ahora mismo.
      </div>
    );
  }

  const data = payload.steps.map((s, i) => ({
    slug: s.slug,
    label: s.label,
    count: s.count,
    fill: colorForRank(i, payload.steps.length),
  }));

  return (
    <div
      data-testid="business-card-drop-off-content"
      className="flex flex-col gap-5"
    >
      <div className="flex items-baseline gap-3 border-b border-zinc-100 pb-4">
        <span
          data-testid="business-drop-off-total"
          className="text-2xl font-semibold text-zinc-900 tabular-nums"
        >
          {payload.totalIncomplete.toLocaleString('es-MX')}
        </span>
        <span className="text-xs uppercase tracking-wider text-zinc-500">
          Personas atascadas en el flujo
        </span>
      </div>

      <div
        data-testid="business-drop-off-chart"
        className="h-56 w-full"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 8, right: 60, left: 8, bottom: 0 }}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="label"
              stroke="#71717a"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              width={140}
            />
            <Tooltip
              cursor={{ fill: '#f4f4f5' }}
              contentStyle={{
                borderRadius: 12,
                border: '1px solid #e4e4e7',
                fontSize: 12,
                boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
              }}
              formatter={(value) => [String(value), 'Atascados']}
              labelStyle={{ color: '#71717a', fontSize: 11 }}
            />
            <Bar dataKey="count" radius={[0, 8, 8, 0]}>
              {data.map((row) => (
                <Cell key={row.slug} fill={row.fill} />
              ))}
              <LabelList
                dataKey="count"
                position="right"
                style={{ fill: '#3f3f46', fontSize: 12, fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <ul className="grid grid-cols-1 gap-1 border-t border-zinc-100 pt-4 text-xs sm:grid-cols-2">
        {payload.steps.map((s, i) => (
          <li
            key={s.slug}
            data-testid={`business-drop-off-row-${s.slug}`}
            className="flex items-center gap-2"
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{
                backgroundColor: colorForRank(i, payload.steps.length),
              }}
              aria-hidden
            />
            <span className="truncate text-zinc-600">{s.label}</span>
            <span className="ml-auto font-semibold text-zinc-900 tabular-nums">
              {s.count.toLocaleString('es-MX')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
