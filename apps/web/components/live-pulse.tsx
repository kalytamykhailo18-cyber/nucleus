/**
 * Live status pulse — a 8px dot with a slowly expanding halo that
 * communicates "real-time, alive" wordlessly. Used on the dashboard's
 * "Servicio Sensu" card to signal that monitoring is currently active.
 *
 * Pure CSS, no JS. The halo is a child span absolutely positioned on top
 * of the dot, scaled and faded by an infinite animation defined inline so
 * it does not bloat the global stylesheet for a single use.
 */
export function LivePulse({
  label = 'Activo',
  className = '',
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 text-xs font-medium text-emerald-700 ${className}`}
    >
      <span className="relative inline-flex h-2 w-2">
        <span
          aria-hidden
          className="absolute inline-flex h-full w-full rounded-full bg-emerald-400/70"
          style={{
            animation: 'live-pulse 2.2s cubic-bezier(0.32, 0.72, 0, 1) infinite',
          }}
        />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      {label}
      <style>{`
        @keyframes live-pulse {
          0%   { transform: scale(1);   opacity: 0.7; }
          70%  { transform: scale(2.4); opacity: 0;   }
          100% { transform: scale(2.4); opacity: 0;   }
        }
      `}</style>
    </span>
  );
}
