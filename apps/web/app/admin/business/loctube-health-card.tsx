'use client';

import {
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
} from 'recharts';
import type { LocTubeHealthPayload } from '@/lib/admin-business';

const TONE_COLOR: Record<LocTubeHealthPayload['tone'], string> = {
  healthy: '#10b981', // emerald-500
  warning: '#f59e0b', // amber-500
  critical: '#f43f5e', // rose-500
};

const TONE_BG: Record<LocTubeHealthPayload['tone'], string> = {
  healthy: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  critical: 'bg-rose-50 text-rose-700',
};

const TONE_LABEL: Record<LocTubeHealthPayload['tone'], string> = {
  healthy: 'Saludable',
  warning: 'Vigilar',
  critical: 'Crítico',
};

export function LocTubeHealthCard({
  payload,
}: {
  payload: LocTubeHealthPayload;
}): React.ReactElement {
  if (payload.totalDevices === 0) {
    return (
      <div
        data-testid="business-card-loctube-health-content"
        className="flex h-40 items-center justify-center text-xs text-zinc-400"
      >
        No hay dispositivos activos aún.
      </div>
    );
  }

  const color = TONE_COLOR[payload.tone];
  const chartData = [
    {
      name: 'salud',
      value: payload.pctHealthy,
      fill: color,
    },
  ];

  return (
    <div
      data-testid="business-card-loctube-health-content"
      className="flex flex-col items-center gap-3"
    >
      <div
        data-testid="business-loctube-chart"
        className="relative h-44 w-full"
      >
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            data={chartData}
            innerRadius="72%"
            outerRadius="100%"
            barSize={16}
            startAngle={90}
            endAngle={-270}
          >
            <PolarAngleAxis
              type="number"
              domain={[0, 100]}
              angleAxisId={0}
              tick={false}
            />
            <RadialBar
              background={{ fill: '#f4f4f5' }}
              dataKey="value"
              cornerRadius={16}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span
            data-testid="business-loctube-pct"
            className="text-3xl font-semibold text-zinc-900 tabular-nums"
            style={{ color }}
          >
            {payload.pctHealthy.toFixed(1)}%
          </span>
          <span
            data-testid="business-loctube-tone-badge"
            className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${TONE_BG[payload.tone]}`}
          >
            {TONE_LABEL[payload.tone]}
          </span>
        </div>
      </div>

      <dl
        data-testid="business-loctube-detail"
        className="grid w-full grid-cols-2 gap-3 border-t border-zinc-100 pt-3 text-xs"
      >
        <div>
          <dt className="uppercase tracking-wider text-zinc-500">En línea 24h</dt>
          <dd className="mt-1 text-base font-semibold text-zinc-900 tabular-nums">
            {payload.activeLast24h.toLocaleString('es-MX')}
          </dd>
        </div>
        <div>
          <dt className="uppercase tracking-wider text-zinc-500">Flota total</dt>
          <dd className="mt-1 text-base font-semibold text-zinc-900 tabular-nums">
            {payload.totalDevices.toLocaleString('es-MX')}
          </dd>
        </div>
      </dl>
    </div>
  );
}
