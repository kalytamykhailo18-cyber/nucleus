import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  LuArrowLeft,
  LuBattery,
  LuBatteryCharging,
  LuClock,
  LuMapPin,
  LuPhone,
  LuRadar,
  LuShield,
  LuTriangleAlert,
} from 'react-icons/lu';
import { SectionLabel } from '@/components/section-label';
import { requireAdmin } from '@/lib/admin';
import { fetchDeviceTimeline } from '@/lib/device-timeline';
import { DeviceTimelineMap } from './device-timeline-map';
import { BatterySparkline } from './battery-sparkline';

export const dynamic = 'force-dynamic';

/**
 * /admin/devices/[imei]
 *
 * Per-device timeline (Phase B closer, 2026-06-15). One page for the
 * call-center to see everything the platform knows about a single
 * pendant: who owns it, last GPS trail, battery curve, recent alerts
 * with the operator-action audit per alert. Server-rendered; the only
 * client components are the Leaflet map and the SVG battery sparkline.
 */
export default async function AdminDeviceTimelinePage({
  params,
}: {
  params: Promise<{ imei: string }>;
}): Promise<React.ReactElement> {
  await requireAdmin();
  const { imei } = await params;

  const data = await fetchDeviceTimeline(imei);
  if (!data) notFound();

  const { meta, gpsTrail, batteryCurve, alerts, lastSeenAt, latestBattery, alertCount30d, totalEventCount } = data;

  const lastSeenLabel = lastSeenAt
    ? new Date(lastSeenAt).toLocaleString('es-MX', {
        timeZone: 'America/Mexico_City',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  return (
    <main
      data-testid="admin-device-timeline"
      className="flex flex-1 flex-col items-center px-6 pt-10 pb-12"
    >
      <div className="w-full max-w-5xl">
        <Link
          href="/admin/fleet"
          data-testid="admin-device-back"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-700"
        >
          <LuArrowLeft aria-hidden className="h-4 w-4" />
          Volver a la flota
        </Link>

        <SectionLabel icon={LuRadar} tone="sensu">
          Dispositivo · línea de tiempo
        </SectionLabel>
        <div className="mt-2 flex flex-wrap items-baseline gap-3">
          <h1
            data-testid="admin-device-imei"
            className="text-3xl sm:text-4xl font-mono font-semibold tracking-tight text-zinc-900"
          >
            {meta.imei}
          </h1>
          {meta.deviceName && (
            <span className="text-base text-zinc-500">{meta.deviceName}</span>
          )}
          {!meta.isActive && (
            <span className="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600 ring-1 ring-zinc-200">
              Inactivo
            </span>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-500">
          <span className="inline-flex items-center gap-1">
            <LuShield aria-hidden className="h-4 w-4 text-zinc-400" />
            {meta.deviceType}
          </span>
          {meta.phoneNumber && (
            <span className="inline-flex items-center gap-1">
              <LuPhone aria-hidden className="h-4 w-4 text-sky-500" />
              <a
                href={`tel:${meta.phoneNumber.replace(/\s/g, '')}`}
                data-testid="admin-device-phone"
                className="text-sky-700 hover:underline"
              >
                {meta.phoneNumber}
              </a>
            </span>
          )}
          {meta.ownerFullName || meta.ownerEmail ? (
            <span data-testid="admin-device-owner">
              Titular: {meta.ownerFullName ?? meta.ownerEmail}
            </span>
          ) : (
            <span>Sin titular asignado</span>
          )}
        </div>

        <section className="mt-8 grid gap-3 sm:grid-cols-4">
          <StatCard
            label="Última señal"
            value={lastSeenLabel}
            tone="sky"
            icon={LuClock}
            testId="admin-device-stat-last-seen"
          />
          <StatCard
            label="Batería actual"
            value={latestBattery !== null ? `${latestBattery}%` : '—'}
            tone={
              latestBattery === null
                ? 'amber'
                : latestBattery < meta.batteryThreshold
                  ? 'rose'
                  : latestBattery < 50
                    ? 'amber'
                    : 'emerald'
            }
            icon={LuBattery}
            testId="admin-device-stat-battery"
          />
          <StatCard
            label="Alertas (30 días)"
            value={alertCount30d.toLocaleString('es-MX')}
            tone={alertCount30d > 0 ? 'rose' : 'emerald'}
            icon={LuTriangleAlert}
            testId="admin-device-stat-alerts"
          />
          <StatCard
            label="Eventos totales"
            value={totalEventCount.toLocaleString('es-MX')}
            tone="sensu"
            icon={LuRadar}
            testId="admin-device-stat-events"
          />
        </section>

        <section className="mt-10">
          <SectionLabel icon={LuMapPin} tone="sky">
            Trayecto GPS (últimas {gpsTrail.length} señales)
          </SectionLabel>
          {gpsTrail.length === 0 ? (
            <p
              data-testid="admin-device-trail-empty"
              className="card-surface mt-4 rounded-3xl px-6 py-10 text-center text-sm text-zinc-500"
            >
              Este dispositivo todavía no ha reportado una posición GPS.
            </p>
          ) : (
            <DeviceTimelineMap points={gpsTrail} />
          )}
        </section>

        <section className="mt-10">
          <SectionLabel icon={LuBatteryCharging} tone="emerald">
            Curva de batería
          </SectionLabel>
          {batteryCurve.length === 0 ? (
            <p
              data-testid="admin-device-battery-empty"
              className="card-surface mt-4 rounded-3xl px-6 py-10 text-center text-sm text-zinc-500"
            >
              Aún no hay lecturas de batería.
            </p>
          ) : (
            <div className="card-surface mt-4 rounded-3xl p-5">
              <BatterySparkline
                points={batteryCurve}
                threshold={meta.batteryThreshold}
              />
            </div>
          )}
        </section>

        <section className="mt-10">
          <SectionLabel icon={LuTriangleAlert} tone="rose">
            Alertas recientes
          </SectionLabel>
          {alerts.length === 0 ? (
            <p
              data-testid="admin-device-alerts-empty"
              className="card-surface mt-4 rounded-3xl px-6 py-10 text-center text-sm text-zinc-500"
            >
              Sin alertas recientes para este dispositivo.
            </p>
          ) : (
            <ul
              data-testid="admin-device-alerts"
              className="mt-4 space-y-3"
            >
              {alerts.map((a) => (
                <AlertRow key={a.id} alert={a} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  tone,
  icon: Icon,
  testId,
}: {
  label: string;
  value: string;
  tone: 'sensu' | 'sky' | 'emerald' | 'amber' | 'rose';
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  testId: string;
}): React.ReactElement {
  const tones: Record<string, { ring: string; text: string }> = {
    sensu: { ring: 'ring-sensu-200', text: 'text-sensu-700' },
    sky: { ring: 'ring-sky-200', text: 'text-sky-700' },
    emerald: { ring: 'ring-emerald-200', text: 'text-emerald-700' },
    amber: { ring: 'ring-amber-200', text: 'text-amber-700' },
    rose: { ring: 'ring-rose-200', text: 'text-rose-700' },
  };
  const t = tones[tone];
  return (
    <div
      data-testid={testId}
      className={`card-surface flex items-center justify-between rounded-3xl p-5 ring-1 ring-inset ${t.ring}`}
    >
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">{label}</p>
        <p className={`mt-1 text-lg font-semibold tabular-nums ${t.text} truncate`}>
          {value}
        </p>
      </div>
      <Icon aria-hidden className={`h-6 w-6 shrink-0 ${t.text}`} />
    </div>
  );
}

function AlertRow({
  alert,
}: {
  alert: import('@/lib/device-timeline').DeviceTimelineAlert;
}): React.ReactElement {
  const tsLabel = new Date(alert.timestamp).toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const kindLabels: Record<string, string> = {
    sos: 'SOS',
    fall_detection: 'Caída',
    battery_low: 'Batería baja',
    geofence: 'Geocerca',
  };
  const label = kindLabels[alert.eventType] ?? alert.eventType;
  const resolved = alert.actions.some((a) => a.kind === 'RESOLVED');

  const actionLabels: Record<string, string> = {
    CALLED_SENIOR: 'Llamó al adulto mayor',
    CALLED_EMERGENCY_CONTACT: 'Llamó al contacto de emergencia',
    CALLED_FAMILY: 'Llamó a la familia',
    PHONED_AURA: 'Llamó a Aura',
    NOTED: 'Anotó',
    RESOLVED: 'Marcó resuelto',
  };

  return (
    <li
      data-testid={`admin-device-alert-${alert.id}`}
      className="card-surface rounded-2xl p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-medium text-zinc-900">{label}</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            {tsLabel}
            {alert.batteryLevel !== null ? ` · ${alert.batteryLevel}%` : ''}
            {alert.lat !== null && alert.lng !== null
              ? ` · ${alert.lat.toFixed(4)}, ${alert.lng.toFixed(4)}`
              : ''}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${
            resolved
              ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
              : 'bg-rose-50 text-rose-700 ring-rose-200'
          }`}
        >
          {resolved ? 'Resuelta' : 'Abierta'}
        </span>
      </div>
      {alert.actions.length > 0 && (
        <ol
          data-testid={`admin-device-alert-${alert.id}-actions`}
          className="mt-3 space-y-1.5 border-l-2 border-zinc-100 pl-4"
        >
          {alert.actions.map((a, idx) => (
            <li key={`${alert.id}-${idx}`} className="text-xs text-zinc-600">
              <span className="font-medium text-zinc-800">
                {actionLabels[a.kind] ?? a.kind}
              </span>
              {' · '}
              <span className="text-zinc-500">{a.operatorEmail}</span>
              {' · '}
              <span className="text-zinc-400">
                {new Date(a.createdAt).toLocaleString('es-MX', {
                  timeZone: 'America/Mexico_City',
                  hour: '2-digit',
                  minute: '2-digit',
                  day: '2-digit',
                  month: '2-digit',
                })}
              </span>
              {a.note && (
                <span className="ml-1 italic text-zinc-600">"{a.note}"</span>
              )}
            </li>
          ))}
        </ol>
      )}
    </li>
  );
}
