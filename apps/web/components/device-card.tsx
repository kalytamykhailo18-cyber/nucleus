import { LuBellRing, LuClock, LuZap } from 'react-icons/lu';
import type { DeviceSummary } from '@/lib/devices';
import { formatLastSeen } from '@/lib/format-last-seen';

/**
 * Device summary card — server component, no client-side JS.
 *
 * Iconography:
 *   - device type: LuBellRing (the SOS pendant is an alert button)
 *   - battery:    inline gauge — battery body + filled bar + large %
 *   - last-seen:  LuClock
 *
 * Status pill: derived from how recently the device reported in.
 *   - <10 min  → "En línea" (emerald)
 *   - <24 h    → "Activo recientemente" (amber)
 *   - longer   → "Sin contacto" (zinc)
 */
function deriveStatus(lastSeenAt: string | null): {
  label: string;
  tone: 'online' | 'recent' | 'offline';
} {
  if (!lastSeenAt) return { label: 'Sin contacto', tone: 'offline' };
  const minutes = (Date.now() - new Date(lastSeenAt).getTime()) / 60_000;
  if (minutes < 10) return { label: 'En línea', tone: 'online' };
  if (minutes < 60 * 24) return { label: 'Activo recientemente', tone: 'recent' };
  return { label: 'Sin contacto', tone: 'offline' };
}

const TONE_CLASSES: Record<'online' | 'recent' | 'offline', string> = {
  online: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  recent: 'bg-amber-50 text-amber-700 ring-amber-200',
  offline: 'bg-zinc-100 text-zinc-600 ring-zinc-200',
};

const DOT_CLASSES: Record<'online' | 'recent' | 'offline', string> = {
  online: 'bg-emerald-500',
  recent: 'bg-amber-500',
  offline: 'bg-zinc-400',
};

/**
 * Battery gauge — battery-shaped visual + filled bar + percentage.
 *
 * Colour follows the semantic icon rule: rose ≤ threshold (low warning),
 * amber 21-60 (mid), emerald 61-100 (healthy). Unknown (null) draws a
 * faint brand-tinted empty body so the row is never blank.
 */
function batteryColors(
  level: number | null,
  threshold: number,
  charging: boolean,
): { fill: string; text: string; track: string; border: string } {
  if (charging) {
    return {
      fill: 'bg-sky-500',
      text: 'text-sky-700',
      track: 'bg-sky-50',
      border: 'border-sky-300',
    };
  }
  if (level === null) {
    return {
      fill: 'bg-zinc-200',
      text: 'text-zinc-500',
      track: 'bg-zinc-50',
      border: 'border-zinc-200',
    };
  }
  if (level <= threshold) {
    return {
      fill: 'bg-rose-500',
      text: 'text-rose-700',
      track: 'bg-rose-50',
      border: 'border-rose-300',
    };
  }
  if (level <= 60) {
    return {
      fill: 'bg-amber-500',
      text: 'text-amber-700',
      track: 'bg-amber-50',
      border: 'border-amber-300',
    };
  }
  return {
    fill: 'bg-emerald-500',
    text: 'text-emerald-700',
    track: 'bg-emerald-50',
    border: 'border-emerald-300',
  };
}

function BatteryGauge({
  level,
  threshold,
  charging = false,
  testId,
}: {
  level: number | null;
  threshold: number;
  charging?: boolean;
  testId?: string;
}) {
  const colors = batteryColors(level, threshold, charging);
  const fillPct =
    level === null ? 0 : Math.max(4, Math.min(100, level));

  return (
    <div className="flex items-center gap-3" data-testid={testId}>
      {/* Battery body */}
      <div className="relative">
        <div
          className={`relative h-10 w-24 overflow-hidden rounded-md border-2 ${colors.border} ${colors.track} p-1`}
        >
          <div
            className={`h-full rounded-sm transition-[width] duration-500 ease-out ${colors.fill}`}
            style={{ width: `${fillPct}%` }}
            aria-hidden
          />
          {charging && (
            <LuZap
              aria-hidden
              className="absolute inset-0 m-auto h-5 w-5 text-white drop-shadow-[0_1px_2px_rgba(15,23,42,0.4)]"
            />
          )}
        </div>
        {/* Battery tip */}
        <div
          aria-hidden
          className={`absolute -right-1.5 top-1/2 h-4 w-1.5 -translate-y-1/2 rounded-r-sm ${colors.border.replace('border-', 'bg-')}`}
        />
      </div>
      <span className={`text-2xl font-semibold tabular-nums ${colors.text}`}>
        {level === null ? '—' : `${level}%`}
      </span>
    </div>
  );
}

export function DeviceCard({
  device,
  animationDelay,
}: {
  device: DeviceSummary;
  animationDelay?: string;
}) {
  const status = deriveStatus(device.lastSeenAt);

  return (
    <div
      data-testid={`device-${device.deviceId}`}
      className="card-surface card-surface-hoverable rounded-3xl p-6 hover:-translate-y-1 animate-rise"
      style={animationDelay ? { animationDelay } : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
            <LuBellRing aria-hidden className="h-4 w-4 text-sensu-500" />
            <span>
              {device.deviceType === 'PENDANT' ? 'Botón Sensu' : device.deviceType}
              {device.isPrimary ? ' · principal' : ''}
            </span>
          </p>
          <h3
            data-testid={`device-${device.deviceId}-label`}
            className="mt-2 text-lg font-semibold tracking-tight text-zinc-900 truncate"
          >
            {device.label}
          </h3>
          <p
            data-testid={`device-${device.deviceId}-id`}
            className="mt-0.5 text-xs text-zinc-500 font-mono truncate"
          >
            {device.deviceId}
          </p>
        </div>
        <span
          data-testid={`device-${device.deviceId}-status`}
          suppressHydrationWarning
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${TONE_CLASSES[status.tone]}`}
        >
          <span
            aria-hidden
            className={`h-1.5 w-1.5 rounded-full ${DOT_CLASSES[status.tone]}`}
          />
          {status.label}
        </span>
      </div>

      <dl className="mt-5 flex flex-col gap-5 text-sm sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div>
          <dt className="text-xs uppercase tracking-[0.14em] text-zinc-500">
            Batería
          </dt>
          <dd className="mt-2">
            <BatteryGauge
              level={device.batteryLevel}
              threshold={device.batteryThreshold}
              testId={`device-${device.deviceId}-battery`}
            />
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-xs uppercase tracking-[0.14em] text-zinc-500">
            <LuClock aria-hidden className="h-4 w-4 text-sky-500" />
            Última conexión
          </dt>
          <dd
            data-testid={`device-${device.deviceId}-lastseen`}
            suppressHydrationWarning
            className="mt-1 text-zinc-700"
          >
            {formatLastSeen(device.lastSeenAt)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
