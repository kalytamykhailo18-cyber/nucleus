'use client';

import { useState } from 'react';
import {
  LuBatteryLow,
  LuChevronDown,
  LuCircleAlert,
  LuExternalLink,
  LuMapPin,
  LuPersonStanding,
  LuRadio,
  LuTriangleAlert,
  LuX,
} from 'react-icons/lu';
import type { ComponentType, SVGProps } from 'react';
import type { AlertSummary, AlertEventType, AlertsPage } from '@/lib/alerts';
import { formatLastSeen } from '@/lib/format-last-seen';

/**
 * Client-side alert history feed.
 *
 * Hydrated from server-fetched alerts so the first paint already shows
 * the list — no spinner. Clicking a row opens a detail panel and POSTs
 * `/api/alerts/:id/read`; the row's read state flips locally and the
 * server-truth is what survives a refresh (the page revalidates on
 * mount via fetch).
 *
 * No polling — alerts are rare enough that on-demand refresh + a future
 * web push (step 9) are the right pattern. Adding a 5s poll here would
 * just hammer Postgres for nothing.
 */

const TYPE_LABEL: Record<AlertEventType, string> = {
  sos: 'SOS',
  fall_detection: 'Caída detectada',
  battery_low: 'Batería baja',
  geofence_enter: 'Entró en geocerca',
  geofence_exit: 'Salió de geocerca',
  button_press: 'Botón lateral',
};

const TYPE_ICON: Record<AlertEventType, ComponentType<SVGProps<SVGSVGElement>>> = {
  sos: LuTriangleAlert,
  fall_detection: LuPersonStanding,
  battery_low: LuBatteryLow,
  geofence_enter: LuMapPin,
  geofence_exit: LuMapPin,
  button_press: LuRadio,
};

const TYPE_TONE: Record<AlertEventType, string> = {
  sos: 'text-sensu-600 bg-sensu-50',
  fall_detection: 'text-amber-600 bg-amber-50',
  battery_low: 'text-amber-600 bg-amber-50',
  geofence_enter: 'text-emerald-600 bg-emerald-50',
  geofence_exit: 'text-amber-600 bg-amber-50',
  button_press: 'text-zinc-600 bg-zinc-100',
};

function formatAbsolute(iso: string): string {
  const d = new Date(iso);
  // Lock to Mexico TZ — server is UTC, browser is Mexico-time; without
  // a stable timeZone the SSR string and the hydrated string disagree
  // and React throws hydration error #418.
  return d.toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AlertsFeed({
  initialAlerts,
  initialNextCursor,
}: {
  initialAlerts: AlertSummary[];
  initialNextCursor: string | null;
}) {
  const [alerts, setAlerts] = useState<AlertSummary[]>(initialAlerts);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = openId ? alerts.find((a) => a.id === openId) ?? null : null;

  async function markRead(id: string): Promise<void> {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, read: true } : a)),
    );
    try {
      await fetch(`/api/alerts/${encodeURIComponent(id)}/read`, {
        method: 'POST',
      });
    } catch {
      // Network blip — leave the optimistic update in place; a refresh
      // will re-sync from server truth.
    }
  }

  function handleOpen(alert: AlertSummary): void {
    setOpenId(alert.id);
    if (!alert.read) void markRead(alert.id);
  }

  async function loadMore(): Promise<void> {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(
        `/api/alerts?cursor=${encodeURIComponent(nextCursor)}`,
      );
      if (!res.ok) return;
      const page = (await res.json()) as AlertsPage;
      setAlerts((prev) => [...prev, ...page.alerts]);
      setNextCursor(page.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }

  if (alerts.length === 0) {
    return (
      <div
        data-testid="alerts-empty"
        className="card-surface flex flex-col items-center rounded-3xl px-8 py-10 text-center"
      >
        <LuCircleAlert aria-hidden className="h-6 w-6 text-sensu-500" />
        <p className="mt-3 text-sm font-medium text-zinc-700">
          Sin alertas registradas todavía.
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Cuando tu Angela detecte una caída, batería baja o un SOS, aparecerá
          aquí — siempre con la alerta más reciente arriba.
        </p>
      </div>
    );
  }

  return (
    <>
      <ul
        data-testid="alerts-list"
        className="card-surface max-h-[420px] divide-y divide-zinc-100 overflow-y-auto rounded-3xl"
      >
        {alerts.map((alert, i) => {
          const Icon = TYPE_ICON[alert.eventType];
          const tone = TYPE_TONE[alert.eventType];
          return (
            <li
              key={alert.id}
              data-testid={`alert-${alert.id}`}
              data-alert-read={alert.read ? 'true' : 'false'}
              className="animate-rise"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <button
                type="button"
                onClick={() => handleOpen(alert)}
                className="flex w-full items-start gap-4 px-5 py-4 text-left transition-colors hover:bg-zinc-50/70 focus-visible:outline-none focus-visible:bg-zinc-50"
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tone}`}
                  aria-hidden
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span
                      data-testid={`alert-${alert.id}-type`}
                      className="text-sm font-medium tracking-tight text-zinc-900"
                    >
                      {TYPE_LABEL[alert.eventType]}
                    </span>
                    {!alert.read && (
                      <span
                        data-testid={`alert-${alert.id}-unread`}
                        aria-label="sin leer"
                        className="inline-block h-1.5 w-1.5 rounded-full bg-sensu-500"
                      />
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-zinc-500">
                    {alert.deviceLabel}
                  </span>
                  {/* Operator-ack indicator (audit gap 6 remainder,
                      Ustym 2026-08-11). Non-null operatorRespondedAt
                      means at least one OperatorAction has been
                      recorded against the alert on the /admin/operator
                      side — the professional queue has picked it up.
                      Small emerald pill so a family scanning the feed
                      knows the call-center is engaged, without having
                      to open the alert modal. */}
                  {alert.operatorRespondedAt && (
                    <span
                      data-testid={`alert-${alert.id}-operator-ack`}
                      className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-100"
                    >
                      <span
                        aria-hidden
                        className="h-1.5 w-1.5 rounded-full bg-emerald-500"
                      />
                      Atendido por el centro
                    </span>
                  )}
                </span>
                <span
                  data-testid={`alert-${alert.id}-time`}
                  suppressHydrationWarning
                  className="shrink-0 text-right text-xs tabular-nums text-zinc-500"
                >
                  <span className="block" suppressHydrationWarning>
                    {formatLastSeen(alert.timestamp)}
                  </span>
                  {/* Audit gap 6 (Ustym 2026-08-10): "Hace 3 horas" is
                      not enough for a family reviewing overnight
                      events — the specific clock time is what they
                      actually want to know. Absolute HH:mm sits below
                      the relative line in dimmer text. Pinned to the
                      America/Mexico_City timezone so the SSR and the
                      client agree (React error #418 otherwise fires
                      because the server renders in UTC while the
                      browser uses local time). */}
                  <span
                    className="block text-[10px] text-zinc-400"
                    suppressHydrationWarning
                  >
                    {new Date(alert.timestamp).toLocaleTimeString('es-MX', {
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: 'America/Mexico_City',
                    })}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
        {nextCursor ? (
          <li className="border-t border-zinc-100">
            <button
              type="button"
              data-testid="alerts-load-more"
              onClick={() => void loadMore()}
              disabled={loadingMore}
              className="flex w-full items-center justify-center gap-1.5 px-5 py-3 text-xs font-medium uppercase tracking-[0.14em] text-zinc-500 transition-colors hover:bg-zinc-50/70 hover:text-zinc-700 disabled:cursor-progress disabled:opacity-60 cursor-pointer"
            >
              {loadingMore ? 'Cargando…' : 'Cargar más'}
              {!loadingMore ? (
                <LuChevronDown aria-hidden className="h-3.5 w-3.5" />
              ) : null}
            </button>
          </li>
        ) : null}
      </ul>

      {open && (
        <div
          data-testid="alert-detail"
          role="dialog"
          aria-modal="true"
          aria-label={`Detalle de alerta ${TYPE_LABEL[open.eventType]}`}
          className="fixed inset-0 z-40 flex items-center justify-center px-4 py-6"
        >
          <div
            className="absolute inset-0 bg-zinc-900/30 backdrop-blur-sm"
            onClick={() => setOpenId(null)}
            aria-hidden
          />
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-[0_2px_4px_rgba(15,23,42,0.06),0_24px_60px_rgba(15,23,42,0.18)] animate-rise">
            <button
              type="button"
              data-testid="alert-detail-close"
              onClick={() => setOpenId(null)}
              className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full text-sky-500 transition-colors hover:bg-sky-50 hover:text-sky-700"
              aria-label="Cerrar"
            >
              <LuX className="h-4 w-4 text-sky-500" aria-hidden />
            </button>
            <div className="flex items-center gap-3">
              {(() => {
                const Icon = TYPE_ICON[open.eventType];
                const tone = TYPE_TONE[open.eventType];
                return (
                  <span
                    aria-hidden
                    className={`flex h-10 w-10 items-center justify-center rounded-full ${tone}`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                );
              })()}
              <div>
                <p
                  data-testid="alert-detail-type"
                  className="text-sm font-medium tracking-tight text-zinc-900"
                >
                  {TYPE_LABEL[open.eventType]}
                </p>
                <p
                  data-testid="alert-detail-device"
                  className="text-xs text-zinc-500"
                >
                  {open.deviceLabel}
                </p>
              </div>
            </div>
            <dl className="mt-6 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                  Fecha y hora
                </dt>
                <dd
                  data-testid="alert-detail-time"
                  className="mt-1 text-zinc-700 tabular-nums"
                >
                  {formatAbsolute(open.timestamp)}
                </dd>
              </div>
              {open.batteryLevel !== null && (
                <div>
                  <dt className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                    Batería
                  </dt>
                  <dd className="mt-1 text-zinc-700 tabular-nums">
                    {open.batteryLevel}%
                  </dd>
                </div>
              )}
              {open.lat !== null && open.lng !== null && (
                <div className="sm:col-span-2">
                  <dt className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                    Ubicación
                  </dt>
                  <dd className="mt-1 flex flex-col gap-1">
                    <a
                      href={`https://www.google.com/maps?q=${open.lat},${open.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid="alert-details-maps-link"
                      className="inline-flex items-center gap-1.5 text-sensu-700 font-medium hover:underline underline-offset-2 cursor-pointer"
                    >
                      <LuMapPin aria-hidden className="h-3.5 w-3.5" />
                      Ver en Google Maps
                      <LuExternalLink aria-hidden className="h-3 w-3" />
                    </a>
                    <span className="text-xs text-zinc-500 tabular-nums">
                      {open.lat.toFixed(5)}, {open.lng.toFixed(5)}
                    </span>
                  </dd>
                </div>
              )}
              {open.buttonType && (
                <div className="sm:col-span-2">
                  <dt className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                    Botón
                  </dt>
                  <dd className="mt-1 text-zinc-700">{open.buttonType}</dd>
                </div>
              )}
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                  ID del dispositivo
                </dt>
                <dd className="mt-1 font-mono text-xs text-zinc-500">
                  {open.deviceId}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </>
  );
}
