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
import type { FunnelPayload } from '@/lib/admin-business';

// Gradient stops per stage — coral/salmon at the top of the funnel,
// deepening toward the emerald "live" state at the bottom, so the eye
// tracks progress positively.
const STAGE_COLORS = [
  '#ff5757', // sensu coral
  '#f97316', // orange-500
  '#eab308', // yellow-500
  '#84cc16', // lime-500
  '#22c55e', // green-500
  '#10b981', // emerald-500
];

function pctLabel(pct: number): string {
  return `${pct.toFixed(pct < 10 ? 1 : 0)}%`;
}

export function FunnelCard({
  payload,
}: {
  payload: FunnelPayload;
}): React.ReactElement {
  const data = payload.stages.map((s, i) => ({
    label: s.label,
    count: s.count,
    pctOfStart: s.pctOfStart,
    pctOfPrev: s.pctOfPrev,
    fill: STAGE_COLORS[i] ?? '#a1a1aa',
  }));

  return (
    <div
      data-testid="business-card-funnel-content"
      className="flex flex-col gap-4"
    >
      <div
        data-testid="business-funnel-chart"
        className="h-72 w-full"
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
              width={130}
            />
            <Tooltip
              cursor={{ fill: '#f4f4f5' }}
              contentStyle={{
                borderRadius: 12,
                border: '1px solid #e4e4e7',
                fontSize: 12,
                boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
              }}
              formatter={(value, _n, item) => {
                const p = item?.payload as { pctOfStart?: number };
                return [
                  `${value} · ${pctLabel(p?.pctOfStart ?? 0)}`,
                  '',
                ];
              }}
              labelStyle={{ color: '#71717a', fontSize: 11 }}
            />
            <Bar dataKey="count" radius={[0, 8, 8, 0]}>
              {data.map((row) => (
                <Cell key={row.label} fill={row.fill} />
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

      <div className="grid grid-cols-2 gap-x-6 gap-y-2 border-t border-zinc-100 pt-4 text-xs sm:grid-cols-3">
        {payload.stages.map((s, i) => (
          <div
            key={s.slug}
            data-testid={`business-funnel-stage-${s.slug}`}
            className="flex items-baseline gap-2"
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: STAGE_COLORS[i] ?? '#a1a1aa' }}
              aria-hidden
            />
            <span className="text-zinc-500">{s.label}</span>
            <span className="ml-auto font-semibold text-zinc-900 tabular-nums">
              {pctLabel(s.pctOfPrev)}
            </span>
          </div>
        ))}
      </div>

      <p className="text-xs italic text-zinc-400">{payload.note}</p>
    </div>
  );
}
