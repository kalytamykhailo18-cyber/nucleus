import type { DeviceTimelineBatteryPoint } from '@/lib/device-timeline';

/**
 * Inline-SVG sparkline of recent battery readings (oldest → newest).
 * The horizontal red dashed line marks the device's low-battery
 * threshold so the operator sees at a glance when the pendant drops
 * into the alert window. No client JS, no chart library; the data
 * never changes after mount so pure SVG is enough.
 */
export function BatterySparkline({
  points,
  threshold,
}: {
  points: DeviceTimelineBatteryPoint[];
  threshold: number;
}): React.ReactElement {
  const width = 720;
  const height = 160;
  const padX = 24;
  const padY = 16;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const n = points.length;
  const x = (i: number): number =>
    n === 1 ? padX + innerW / 2 : padX + (i / (n - 1)) * innerW;
  const y = (battery: number): number =>
    padY + (1 - Math.max(0, Math.min(100, battery)) / 100) * innerH;

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.batteryLevel).toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L${x(n - 1).toFixed(1)},${(padY + innerH).toFixed(1)} L${x(0).toFixed(1)},${(padY + innerH).toFixed(1)} Z`;
  const thresholdY = y(threshold);

  const first = points[0];
  const last = points[n - 1];
  const dateFmt = (iso: string): string =>
    new Date(iso).toLocaleDateString('es-MX', {
      timeZone: 'America/Mexico_City',
      day: '2-digit',
      month: '2-digit',
    });

  return (
    <div data-testid="admin-device-battery-sparkline">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="block w-full h-40"
        role="img"
        aria-label="Curva de batería del dispositivo"
      >
        {/* Background grid lines at 25/50/75/100 */}
        {[0, 25, 50, 75, 100].map((pct) => (
          <line
            key={pct}
            x1={padX}
            x2={padX + innerW}
            y1={y(pct)}
            y2={y(pct)}
            stroke="#e4e4e7"
            strokeWidth={1}
          />
        ))}
        {/* Threshold line */}
        <line
          x1={padX}
          x2={padX + innerW}
          y1={thresholdY}
          y2={thresholdY}
          stroke="#f43f5e"
          strokeWidth={1.5}
          strokeDasharray="6 4"
        />
        <text
          x={padX + innerW - 6}
          y={thresholdY - 4}
          textAnchor="end"
          fill="#f43f5e"
          fontSize="11"
          fontFamily="ui-sans-serif, system-ui"
        >
          umbral {threshold}%
        </text>
        {/* Battery curve fill + line */}
        <path d={areaPath} fill="#a7f3d0" fillOpacity={0.35} />
        <path
          d={linePath}
          fill="none"
          stroke="#059669"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Endpoint dots */}
        <circle
          cx={x(0)}
          cy={y(first.batteryLevel)}
          r={3}
          fill="#059669"
        />
        <circle
          cx={x(n - 1)}
          cy={y(last.batteryLevel)}
          r={4}
          fill="#059669"
        />
        <text
          x={x(n - 1) - 6}
          y={y(last.batteryLevel) - 8}
          textAnchor="end"
          fill="#065f46"
          fontSize="12"
          fontFamily="ui-sans-serif, system-ui"
        >
          {last.batteryLevel}%
        </text>
      </svg>
      <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
        <span>{dateFmt(first.timestamp)}</span>
        <span>
          {n} lectura{n === 1 ? '' : 's'}
        </span>
        <span>{dateFmt(last.timestamp)}</span>
      </div>
    </div>
  );
}
