'use client';

import { useEffect, useRef } from 'react';
import L, {
  type Map as LeafletMap,
  type Marker as LeafletMarker,
} from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { OperatorMapAlert } from '@/lib/operator-map';
import type { OperatorPresence } from '@/lib/operator-presence';

/**
 * Operator alert overlay (Phase B polish, 2026-06-10).
 *
 * One Leaflet teardrop per actionable unresolved EviewEvent at the
 * device's reported lat/lng. Color encodes the operator who took the
 * latest action; yellow (#facc15) when no operator has claimed the
 * alert yet. Click a marker to open the same alert-detail modal the
 * queue rows use — wiring is via the `onMarkerClick(eventId)` prop.
 *
 * The legend renders one row per operator currently on shift (passed
 * from the presence panel data); each carries the matching color
 * swatch and the operator's load count. Unclaimed alerts surface as a
 * separate amber legend entry so the dispatcher can see at a glance
 * how many alerts are nobody's yet.
 *
 * Pattern mirrors fleet-map-client.tsx — same Leaflet engine, same
 * teardrop SVG generator, same `setAttribute('data-testid', …)` on the
 * marker element so specs can address a specific event by id.
 */

const UNCLAIMED_COLOR = '#facc15'; // amber-400

/**
 * Deterministic operator-id → hue palette. Hash the id to a hue in
 * [0, 360), build an HSL color. The same operator always renders in
 * the same color across reloads so dispatcher muscle memory builds.
 */
function operatorColor(operatorId: string): string {
  let h = 0;
  for (let i = 0; i < operatorId.length; i++) {
    h = (h * 31 + operatorId.charCodeAt(i)) >>> 0;
  }
  const hue = h % 360;
  return `hsl(${hue}, 70%, 50%)`;
}

function pinSvg(color: string): string {
  return `<svg viewBox="0 0 28 36" width="28" height="36" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M14 35 C 14 35 26 23 26 13 A 12 12 0 0 0 2 13 C 2 23 14 35 14 35 Z"
          fill="${color}" stroke="white" stroke-width="2"/>
    <circle cx="14" cy="13" r="4.5" fill="white"/>
  </svg>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function alertTypeLabel(t: string): string {
  switch (t) {
    case 'sos':
      return 'SOS';
    case 'fall_detection':
      return 'Caída detectada';
    case 'battery_low':
      return 'Batería baja';
    case 'geofence_enter':
      return 'Entrada de geocerca';
    case 'geofence_exit':
      return 'Salida de geocerca';
    case 'button_press':
      return 'Botón presionado';
    default:
      return t;
  }
}

function popupHtml(a: OperatorMapAlert): string {
  const label = a.deviceName ?? a.deviceId;
  const occurred = new Date(a.occurredAt).toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `
    <div style="font-family:-apple-system,Inter,sans-serif;min-width:180px">
      <div style="font-weight:600;color:#18181b;font-size:13px">${escapeHtml(alertTypeLabel(a.alertType))}</div>
      <div style="font-size:12px;color:#52525b;margin-top:2px">${escapeHtml(label)}</div>
      <div style="font-size:11px;color:#71717a;margin-top:4px;font-variant-numeric:tabular-nums">${escapeHtml(occurred)}</div>
    </div>
  `;
}

export function OperatorMapClient({
  alerts,
  presence,
  onMarkerClick,
}: {
  alerts: OperatorMapAlert[];
  presence: OperatorPresence[];
  onMarkerClick: (eventId: string) => void;
}): React.ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<LeafletMarker[]>([]);
  const markersByEventRef = useRef<Map<string, LeafletMarker>>(new Map());

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialCenter: [number, number] =
      alerts.length > 0
        ? [alerts[0]!.lat, alerts[0]!.lng]
        : [19.4326, -99.1332];

    const map = L.map(containerRef.current, {
      center: initialCenter,
      zoom: alerts.length > 0 ? 6 : 11,
      attributionControl: true,
      zoomControl: true,
    });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    for (const a of alerts) {
      const color = a.operatorId
        ? operatorColor(a.operatorId)
        : UNCLAIMED_COLOR;
      const marker = L.marker([a.lat, a.lng], {
        icon: L.divIcon({
          className: 'operator-alert-pin',
          html: pinSvg(color),
          iconSize: [28, 36],
          iconAnchor: [14, 35],
          popupAnchor: [0, -32],
        }),
      });
      marker.bindPopup(popupHtml(a), { maxWidth: 240 });
      marker.on('click', () => onMarkerClick(a.eventId));
      marker.addTo(map);
      const el = marker.getElement();
      if (el) {
        el.setAttribute('data-testid', `operator-map-marker-${a.eventId}`);
        if (a.operatorId) {
          el.setAttribute('data-operator-id', a.operatorId);
        } else {
          el.setAttribute('data-operator-id', 'unclaimed');
        }
      }
      markersRef.current.push(marker);
      markersByEventRef.current.set(a.eventId, marker);
    }

    if (alerts.length > 1) {
      const bounds = L.latLngBounds(alerts.map((a) => [a.lat, a.lng]));
      map.fitBounds(bounds, { padding: [40, 40] });
    }

    mapRef.current = map;
    // Expose map + per-event marker map on window so specs can fire
    // a programmatic click without fighting Leaflet's DOM-level SVG
    // pointer-event interception — same pattern as fleet-map-client.
    (
      window as unknown as {
        __nucleusOperatorMap?: LeafletMap;
        __nucleusOperatorMapMarkers?: Map<string, LeafletMarker>;
      }
    ).__nucleusOperatorMap = map;
    (
      window as unknown as {
        __nucleusOperatorMapMarkers?: Map<string, LeafletMarker>;
      }
    ).__nucleusOperatorMapMarkers = markersByEventRef.current;

    return () => {
      for (const m of markersRef.current) m.remove();
      markersRef.current = [];
      markersByEventRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, [alerts, onMarkerClick]);

  const unclaimedCount = alerts.filter((a) => a.operatorId === null).length;

  return (
    <section
      data-testid="operator-map-panel"
      className="mt-6 rounded-2xl bg-white ring-1 ring-zinc-200"
    >
      <header className="flex items-center justify-between px-4 py-3">
        <h2 className="text-xs uppercase tracking-[0.18em] text-zinc-500">
          Mapa de alertas activas · {alerts.length}
        </h2>
      </header>
      <div
        ref={containerRef}
        data-testid="operator-map-canvas"
        className="h-80 w-full overflow-hidden"
      />
      <ul
        data-testid="operator-map-legend"
        className="flex flex-wrap items-center gap-2 px-4 py-3 text-xs"
      >
        {presence.map((p) => (
          <li
            key={p.operatorId}
            data-testid={`operator-map-legend-${p.operatorId}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-zinc-50 px-3 py-1 ring-1 ring-zinc-200"
          >
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: operatorColor(p.operatorId) }}
            />
            <span className="font-medium text-zinc-900">
              {p.fullName ?? p.email}
            </span>
            <span className="text-zinc-500">· {p.load}</span>
          </li>
        ))}
        {unclaimedCount > 0 && (
          <li
            data-testid="operator-map-legend-unclaimed"
            className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 ring-1 ring-amber-200"
          >
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: UNCLAIMED_COLOR }}
            />
            <span className="font-medium text-amber-900">Sin reclamar</span>
            <span className="text-amber-700">· {unclaimedCount}</span>
          </li>
        )}
        {presence.length === 0 && unclaimedCount === 0 && (
          <li className="text-zinc-500">
            Sin alertas activas en las últimas 24 h.
          </li>
        )}
      </ul>
    </section>
  );
}
