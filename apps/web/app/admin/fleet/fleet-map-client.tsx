'use client';

import { useEffect, useRef, useState } from 'react';
import L, {
  type Map as LeafletMap,
  type Marker as LeafletMarker,
  type TileLayer as LeafletTileLayer,
} from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { FleetDevice } from '@/lib/fleet-map';

/**
 * Fleet-wide live map (Phase B Q1, Juan 2026-05-25).
 *
 * One pin per active pendant that has a known GPS fix. Click a pin →
 * popup with senior name, battery, last-seen timestamp, and a link to
 * the device's caller-ID surface in /admin/operator.
 *
 * Engine: Leaflet over OpenStreetMap raster tiles — same pattern as
 * the family dashboard map. Leaflet sidesteps WebGL so the page
 * renders on every browser the call-center actually uses.
 */

type FleetDeviceWithFix = FleetDevice & { lat: number; lng: number };

function hasFix(d: FleetDevice): d is FleetDeviceWithFix {
  return d.lat !== null && d.lng !== null;
}

const STREET_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const STREET_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const SATELLITE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const SATELLITE_ATTR =
  'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community';

function pinSvg(color: string): string {
  return `<svg viewBox="0 0 28 36" width="28" height="36" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M14 35 C 14 35 26 23 26 13 A 12 12 0 0 0 2 13 C 2 23 14 35 14 35 Z"
          fill="${color}" stroke="white" stroke-width="2"/>
    <circle cx="14" cy="13" r="4.5" fill="white"/>
  </svg>`;
}

function formatLastSeen(iso: string | null): string {
  if (!iso) return 'sin contacto';
  const d = new Date(iso);
  return d.toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function popupHtml(
  d: FleetDeviceWithFix,
  popupBehavior: 'admin' | 'maps',
): string {
  const senior = d.masterName ?? '<em>Sin titular asignado</em>';
  const label = d.deviceName ?? d.deviceId;
  const battery =
    d.batteryLevel !== null ? `${d.batteryLevel}% batería` : 'Sin batería';
  const lastSeen = formatLastSeen(d.lastSeenAt);
  // Two flavors:
  //   admin → click-through to /admin/devices/[imei] + /admin/operator
  //           for the dispatcher workflow.
  //   maps  → click-through to Google Maps at the pin's coordinates
  //           for the company-side HR lead (Juan 2026-06-23 — D.1a).
  const actions =
    popupBehavior === 'maps'
      ? `
        <a data-testid="fleet-popup-maps" href="https://www.google.com/maps?q=${d.lat},${d.lng}" target="_blank" rel="noreferrer noopener" style="display:inline-block;padding:4px 10px;background:#059669;color:#fff;border-radius:9999px;text-decoration:none;font-size:11px;font-weight:500">
          Abrir en Google Maps
        </a>
      `
      : `
        <a data-testid="fleet-popup-timeline" href="/admin/devices/${encodeURIComponent(d.deviceId)}" style="display:inline-block;padding:4px 10px;background:#e11d48;color:#fff;border-radius:9999px;text-decoration:none;font-size:11px;font-weight:500">
          Línea de tiempo
        </a>
        <a data-testid="fleet-popup-operator" href="/admin/operator" style="display:inline-block;padding:4px 10px;background:#0284c7;color:#fff;border-radius:9999px;text-decoration:none;font-size:11px;font-weight:500">
          Abrir cola del operador
        </a>
      `;
  return `
    <div style="font-family:-apple-system,Inter,sans-serif;min-width:200px">
      <div style="font-weight:600;color:#18181b;font-size:13px;line-height:1.2">${escapeHtml(label)}</div>
      <div style="font-size:12px;color:#52525b;margin-top:2px">${escapeHtml(senior)}</div>
      <div style="font-size:11px;color:#71717a;margin-top:6px;line-height:1.5">
        ${escapeHtml(battery)}<br/>
        Último contacto: <span style="font-variant-numeric:tabular-nums">${escapeHtml(lastSeen)}</span><br/>
        <span style="font-family:ui-monospace,Menlo,monospace;font-size:10px">${escapeHtml(d.deviceId)}</span>
      </div>
      <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px">
        ${actions}
      </div>
    </div>
  `;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function FleetMapClient({
  devices,
  popupBehavior = 'admin',
}: {
  devices: FleetDevice[];
  /** Juan 2026-06-23 (D.1a). 'admin' opens /admin/devices + /admin/operator
   *  in the popup; 'maps' opens Google Maps at the pin's coordinates.
   *  Company-side surfaces pass 'maps' so HR leads land somewhere they
   *  have access to instead of an admin-only page. */
  popupBehavior?: 'admin' | 'maps';
}): React.ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<LeafletMarker[]>([]);
  const markersByIdRef = useRef<Map<string, LeafletMarker>>(new Map());
  const streetLayerRef = useRef<LeafletTileLayer | null>(null);
  const satLayerRef = useRef<LeafletTileLayer | null>(null);
  const [layerKind, setLayerKind] = useState<'street' | 'satellite'>('street');

  const fixed = devices.filter(hasFix);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialCenter: [number, number] =
      fixed.length > 0
        ? [fixed[0]!.lat, fixed[0]!.lng]
        : [19.4326, -99.1332];

    const map = L.map(containerRef.current, {
      center: initialCenter,
      zoom: fixed.length > 0 ? 6 : 11,
      attributionControl: true,
      zoomControl: true,
    });

    const street = L.tileLayer(STREET_URL, {
      attribution: STREET_ATTR,
      maxZoom: 19,
    });
    const satellite = L.tileLayer(SATELLITE_URL, {
      attribution: SATELLITE_ATTR,
      maxZoom: 19,
    });
    street.addTo(map);
    streetLayerRef.current = street;
    satLayerRef.current = satellite;

    // Drop one teardrop per fixed device.
    for (const d of fixed) {
      const marker = L.marker([d.lat, d.lng], {
        icon: L.divIcon({
          className: 'fleet-pin',
          html: pinSvg('#fb7185'),
          iconSize: [28, 36],
          iconAnchor: [14, 35],
          popupAnchor: [0, -32],
        }),
      });
      marker.bindPopup(popupHtml(d, popupBehavior), { maxWidth: 280 });
      marker.addTo(map);
      // Element-level testid so a spec can deterministically click a
      // known device's pin without depending on z-order.
      const el = marker.getElement();
      if (el) el.setAttribute('data-testid', `fleet-pin-${d.deviceId}`);
      markersRef.current.push(marker);
      markersByIdRef.current.set(d.deviceId, marker);
    }

    if (fixed.length > 1) {
      const bounds = L.latLngBounds(fixed.map((d) => [d.lat, d.lng]));
      map.fitBounds(bounds, { padding: [40, 40] });
    }

    mapRef.current = map;
    // Expose both the map and the per-device markers on `window` so
    // E2E specs can openPopup() programmatically — Leaflet packs
    // markers tightly at fit-bounds zoom levels and DOM-level pin
    // clicks routinely get intercepted by adjacent markers in
    // production-density fixtures.
    (window as unknown as {
      __nucleusFleetMap?: LeafletMap;
      __nucleusFleetMarkers?: Map<string, LeafletMarker>;
    }).__nucleusFleetMap = map;
    (window as unknown as {
      __nucleusFleetMarkers?: Map<string, LeafletMarker>;
    }).__nucleusFleetMarkers = markersByIdRef.current;

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      markersByIdRef.current.clear();
      streetLayerRef.current?.remove();
      satLayerRef.current?.remove();
      streetLayerRef.current = null;
      satLayerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bfcache safety — Leaflet schedules animation frames that throw if
  // the page is bfcache-restored. Tear the map down on pagehide and
  // hard-reload on pageshow.persisted (matches the dashboard map).
  useEffect(() => {
    const onPageHide = () => {
      const map = mapRef.current;
      if (!map) return;
      try {
        markersRef.current.forEach((m) => m.remove());
        markersRef.current = [];
        streetLayerRef.current?.remove();
        satLayerRef.current?.remove();
        streetLayerRef.current = null;
        satLayerRef.current = null;
        map.remove();
      } catch {
        /* defensive */
      }
      mapRef.current = null;
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) window.location.reload();
    };
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, []);

  // Layer toggle — same pattern as the dashboard map.
  useEffect(() => {
    const map = mapRef.current;
    const street = streetLayerRef.current;
    const satellite = satLayerRef.current;
    if (!map || !street || !satellite) return;
    if (layerKind === 'street') {
      if (!map.hasLayer(street)) street.addTo(map);
      if (map.hasLayer(satellite)) map.removeLayer(satellite);
    } else {
      if (!map.hasLayer(satellite)) satellite.addTo(map);
      if (map.hasLayer(street)) map.removeLayer(street);
    }
  }, [layerKind]);

  return (
    <div className="mt-8">
      <div
        data-testid="admin-fleet-stats"
        className="flex flex-wrap items-center gap-4 text-xs text-zinc-600"
      >
        <span>
          <strong className="text-zinc-900 tabular-nums">{fixed.length}</strong>{' '}
          con ubicación
        </span>
        <span>
          <strong className="text-zinc-900 tabular-nums">{devices.length - fixed.length}</strong>{' '}
          sin contacto
        </span>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-white p-1 ring-1 ring-zinc-200">
          <button
            type="button"
            data-testid="fleet-layer-street"
            aria-pressed={layerKind === 'street'}
            onClick={() => setLayerKind('street')}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
              layerKind === 'street'
                ? 'bg-zinc-900 text-white'
                : 'text-zinc-700 hover:bg-zinc-50'
            }`}
          >
            Mapa
          </button>
          <button
            type="button"
            data-testid="fleet-layer-satellite"
            aria-pressed={layerKind === 'satellite'}
            onClick={() => setLayerKind('satellite')}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
              layerKind === 'satellite'
                ? 'bg-zinc-900 text-white'
                : 'text-zinc-700 hover:bg-zinc-50'
            }`}
          >
            Satélite
          </button>
        </span>
      </div>

      <div
        ref={containerRef}
        data-testid="admin-fleet-map"
        className="mt-4 h-[60vh] min-h-96 rounded-3xl ring-1 ring-zinc-200 overflow-hidden"
      />

    </div>
  );
}
