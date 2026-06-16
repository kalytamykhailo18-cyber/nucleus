'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import L, {
  type Map as LeafletMap,
  type Marker as LeafletMarker,
  type Circle as LeafletCircle,
  type LayerGroup as LeafletLayerGroup,
  type TileLayer as LeafletTileLayer,
} from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  LuMapPin,
  LuPencil,
  LuPlus,
  LuSearch,
  LuTrash2,
  LuX,
} from 'react-icons/lu';
import type {
  GeofenceDirection,
  GeofenceSummary,
} from '@/lib/geofences';
import { ConfirmModal } from './confirm-modal';

/**
 * Map-based geofence editor.
 *
 * CRUD surfaces:
 *   - Create  : "Nueva geocerca" → inline form section below the map,
 *               page smooth-scrolls to it on open.
 *   - Edit    : pencil icon on a row → same inline form, pre-populated.
 *   - Delete  : trash icon → <ConfirmModal> overlay (destructive — keep
 *               the focus-narrowing modal for this one).
 *
 * The map stays fully visible and clickable while the form is open. The
 * map's click handler updates the form's centerLat/Lng so the user can
 * drag the geocerca center around without losing form state. ESC closes
 * the form. The form auto-focuses its first input on open.
 *
 * Eview hardware caps each device at 4 active zones, so the editor
 * disables "Nueva geocerca" once a device's slots are full and surfaces
 * the API's 409 message inline.
 */

interface DeviceOption {
  deviceId: string;
  label: string;
}

interface FormState {
  id: string | null;
  deviceId: string;
  name: string;
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  direction: GeofenceDirection;
}

const DIRECTION_LABEL: Record<GeofenceDirection, string> = {
  ENTER: 'Entrada',
  LEAVE: 'Salida',
  BOTH: 'Ambas',
};

const DEFAULT_RADIUS = 200;

const STREET_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const STREET_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const SATELLITE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const SATELLITE_ATTR = 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community';

// Geofence circles use a dual-stroke "halo" technique so the perimeter
// stays readable against any base layer — green parks, gray streets,
// satellite imagery with red roofs / brown earth. The white halo sits
// underneath; the brand-coral stroke rides on top.
const FILL_STYLE = {
  color: '#ee3a3a',
  weight: 3,
  fillColor: '#ff5757',
  fillOpacity: 0.22,
};
const FILL_HALO_STYLE = {
  color: '#ffffff',
  weight: 7,
  opacity: 0.9,
  fill: false,
};
const READONLY_STYLE = {
  color: '#ee3a3a',
  weight: 2,
  opacity: 0.95,
  fillColor: '#ff5757',
  fillOpacity: 0.12,
};
const READONLY_HALO_STYLE = {
  color: '#ffffff',
  weight: 5,
  opacity: 0.75,
  fill: false,
};

export function GeofenceEditor({
  initialGeofences,
  devices,
}: {
  initialGeofences: GeofenceSummary[];
  devices: DeviceOption[];
}) {
  const [geofences, setGeofences] = useState<GeofenceSummary[]>(initialGeofences);
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<GeofenceSummary | null>(null);
  const [addressQuery, setAddressQuery] = useState('');
  const [addressResults, setAddressResults] = useState<
    Array<{ lat: number; lng: number; label: string }>
  >([]);
  const [addressBusy, setAddressBusy] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const editCircleRef = useRef<LeafletCircle | null>(null);
  const editHaloRef = useRef<LeafletCircle | null>(null);
  const readonlyLayerRef = useRef<LeafletLayerGroup | null>(null);
  const streetLayerRef = useRef<LeafletTileLayer | null>(null);
  const satLayerRef = useRef<LeafletTileLayer | null>(null);
  const formRef = useRef<HTMLElement | null>(null);
  const [layerKind, setLayerKind] = useState<'street' | 'satellite'>('street');

  // When the inline form opens (Nueva or Editar), smooth-scroll the page
  // so the form is in view and focus the first field.
  useEffect(() => {
    if (form === null || !formRef.current) return;
    formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const firstField = formRef.current.querySelector<HTMLElement>(
      'input, select, textarea, button',
    );
    // Slight delay so the smooth scroll doesn't fight the focus; mobile
    // keyboards in particular pop up before the scroll finishes otherwise.
    const t = window.setTimeout(() => firstField?.focus(), 250);
    return () => window.clearTimeout(t);
  }, [form?.id, form === null]);

  // ESC closes the form (parity with the previous modal behavior; GEO-5
  // relies on this). Only listens while the form is open.
  useEffect(() => {
    if (form === null) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') cancelForm();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form === null]);

  const zonesUsedByDevice = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of geofences) {
      m.set(g.deviceId, (m.get(g.deviceId) ?? 0) + 1);
    }
    return m;
  }, [geofences]);

  const canCreateOnAnyDevice = devices.some(
    (d) => (zonesUsedByDevice.get(d.deviceId) ?? 0) < 4,
  );

  // Initialise map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initial: [number, number] =
      initialGeofences[0]
        ? [initialGeofences[0].centerLat, initialGeofences[0].centerLng]
        : [19.4326, -99.1332];

    const map = L.map(containerRef.current, {
      center: initial,
      zoom: 13,
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

    readonlyLayerRef.current = L.layerGroup().addTo(map);

    map.on('click', (event) => {
      setForm((prev) =>
        prev
          ? { ...prev, centerLat: event.latlng.lat, centerLng: event.latlng.lng }
          : prev,
      );
    });

    mapRef.current = map;
    (window as unknown as { __nucleusMap?: LeafletMap }).__nucleusMap = map;

    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
      editHaloRef.current?.remove();
      editHaloRef.current = null;
      editCircleRef.current?.remove();
      editCircleRef.current = null;
      readonlyLayerRef.current?.clearLayers();
      readonlyLayerRef.current = null;
      streetLayerRef.current?.remove();
      satLayerRef.current?.remove();
      streetLayerRef.current = null;
      satLayerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swap base layer when the toggle flips.
  useEffect(() => {
    const map = mapRef.current;
    const street = streetLayerRef.current;
    const sat = satLayerRef.current;
    if (!map || !street || !sat) return;
    if (layerKind === 'street') {
      if (!map.hasLayer(street)) street.addTo(map);
      if (map.hasLayer(sat)) sat.remove();
    } else {
      if (!map.hasLayer(sat)) sat.addTo(map);
      if (map.hasLayer(street)) street.remove();
    }
  }, [layerKind]);

  // Render the existing geofences on the map (read-only circles).
  useEffect(() => {
    const layer = readonlyLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    for (const g of geofences) {
      if (form && g.id === form.id) continue; // hide the one being edited
      // White halo underneath, brand stroke on top — keeps the perimeter
      // readable against any base layer (street, satellite, parks, roofs).
      L.circle([g.centerLat, g.centerLng], {
        radius: g.radiusMeters,
        ...READONLY_HALO_STYLE,
      }).addTo(layer);
      L.circle([g.centerLat, g.centerLng], {
        radius: g.radiusMeters,
        ...READONLY_STYLE,
      }).addTo(layer);
    }
  }, [geofences, form]);

  // Render the editor circle + draggable marker for the form's state.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!form) {
      markerRef.current?.remove();
      markerRef.current = null;
      editHaloRef.current?.remove();
      editHaloRef.current = null;
      editCircleRef.current?.remove();
      editCircleRef.current = null;
      return;
    }

    const latLng: [number, number] = [form.centerLat, form.centerLng];

    if (!markerRef.current) {
      const icon = L.divIcon({
        className: 'geofence-edit-marker-wrap',
        html: '<div class="geofence-edit-marker"></div>',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      const m = L.marker(latLng, { icon, draggable: true }).addTo(map);
      m.on('dragend', () => {
        const pos = m.getLatLng();
        setForm((prev) =>
          prev ? { ...prev, centerLat: pos.lat, centerLng: pos.lng } : prev,
        );
      });
      markerRef.current = m;
    } else {
      markerRef.current.setLatLng(latLng);
    }

    if (!editHaloRef.current) {
      editHaloRef.current = L.circle(latLng, {
        radius: form.radiusMeters,
        ...FILL_HALO_STYLE,
      }).addTo(map);
    } else {
      editHaloRef.current.setLatLng(latLng).setRadius(form.radiusMeters);
    }

    if (!editCircleRef.current) {
      editCircleRef.current = L.circle(latLng, {
        radius: form.radiusMeters,
        ...FILL_STYLE,
      }).addTo(map);
    } else {
      editCircleRef.current.setLatLng(latLng).setRadius(form.radiusMeters);
      editCircleRef.current.bringToFront();
    }

    map.flyTo(latLng, map.getZoom(), { animate: true, duration: 0.4 });
  }, [form]);

  // Geocode a free-text address through Nominatim (OpenStreetMap). Free,
  // no API key, but rate-limited to ~1 req/s under their fair-use policy —
  // we fire one request per explicit search, never on keystroke.
  async function searchAddress(): Promise<void> {
    const q = addressQuery.trim();
    if (q.length < 3) return;
    setAddressBusy(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&accept-language=es-MX`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) {
        setAddressResults([]);
        return;
      }
      const data = (await res.json()) as Array<{
        lat: string;
        lon: string;
        display_name: string;
      }>;
      setAddressResults(
        data.map((r) => ({
          lat: Number.parseFloat(r.lat),
          lng: Number.parseFloat(r.lon),
          label: r.display_name,
        })),
      );
    } catch {
      setAddressResults([]);
    } finally {
      setAddressBusy(false);
    }
  }

  function pickAddress(result: { lat: number; lng: number }): void {
    setForm((prev) =>
      prev ? { ...prev, centerLat: result.lat, centerLng: result.lng } : prev,
    );
    setAddressResults([]);
    setAddressQuery('');
  }

  function startCreate(): void {
    setError(null);
    const firstFreeDevice =
      devices.find((d) => (zonesUsedByDevice.get(d.deviceId) ?? 0) < 4) ?? devices[0];
    if (!firstFreeDevice) {
      setError('No tienes dispositivos con espacio para más geocercas.');
      return;
    }
    const center = mapRef.current?.getCenter();
    setForm({
      id: null,
      deviceId: firstFreeDevice.deviceId,
      name: '',
      centerLat: center?.lat ?? 19.4326,
      centerLng: center?.lng ?? -99.1332,
      radiusMeters: DEFAULT_RADIUS,
      direction: 'BOTH',
    });
    // Leaflet's getCenter() returns LatLng — same shape as MapLibre's
    // getCenter(), so this code is unchanged.
  }

  function startEdit(g: GeofenceSummary): void {
    setError(null);
    setForm({
      id: g.id,
      deviceId: g.deviceId,
      name: g.name,
      centerLat: g.centerLat,
      centerLng: g.centerLng,
      radiusMeters: g.radiusMeters,
      direction: g.direction,
    });
  }

  function cancelForm(): void {
    setForm(null);
    setError(null);
    setAddressQuery('');
    setAddressResults([]);
  }

  async function save(): Promise<void> {
    if (!form) return;
    setBusy(true);
    setError(null);
    try {
      if (form.id) {
        const res = await fetch(`/api/geofences/${encodeURIComponent(form.id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name,
            centerLat: form.centerLat,
            centerLng: form.centerLng,
            radiusMeters: form.radiusMeters,
            direction: form.direction,
          }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { message?: string };
          setError(body.message ?? 'No se pudo guardar la geocerca.');
          return;
        }
        const body = (await res.json()) as { geofence: GeofenceSummary };
        setGeofences((prev) =>
          prev.map((g) => (g.id === body.geofence.id ? body.geofence : g)),
        );
      } else {
        const res = await fetch('/api/geofences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceId: form.deviceId,
            name: form.name,
            centerLat: form.centerLat,
            centerLng: form.centerLng,
            radiusMeters: form.radiusMeters,
            direction: form.direction,
          }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { message?: string };
          setError(body.message ?? 'No se pudo crear la geocerca.');
          return;
        }
        const body = (await res.json()) as { geofence: GeofenceSummary };
        setGeofences((prev) => [...prev, body.geofence]);
      }
      setForm(null);
    } finally {
      setBusy(false);
    }
  }

  async function remove(g: GeofenceSummary): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/geofences/${encodeURIComponent(g.id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        setError('No se pudo eliminar la geocerca.');
        return;
      }
      setGeofences((prev) => prev.filter((other) => other.id !== g.id));
      if (form?.id === g.id) setForm(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* z-0 caps Leaflet's internal panes (tiles 200, overlay 400, markers
          600, controls 800) inside this stacking context, so the modal at
          z-1000 in the root context always wins. */}
      <div className="card-surface relative z-0 -mx-6 h-[66vh] min-h-[360px] overflow-hidden rounded-none sm:mx-0 sm:rounded-3xl">
        <div ref={containerRef} className="absolute inset-0" />
        {/* Fixed crosshair at the viewport center of the map. Shows the user
            exactly where a new geofence will be planted when they click
            "Nueva geocerca" (which seeds the form's center from
            map.getCenter()). pointer-events:none so it never blocks map
            interactions. */}
        <div
          data-testid="map-center-cross"
          aria-hidden
          className="map-center-cross pointer-events-none absolute left-1/2 top-1/2 z-[800] -translate-x-1/2 -translate-y-1/2"
        />
        <div
          data-testid="map-layer-toggle"
          className="absolute right-3 top-3 z-[900] inline-flex rounded-full bg-white/90 p-0.5 text-xs font-medium shadow-[0_1px_3px_rgba(15,23,42,0.10),0_4px_12px_rgba(15,23,42,0.06)] backdrop-blur"
        >
          <button
            type="button"
            data-testid="map-layer-street"
            onClick={() => setLayerKind('street')}
            className={`rounded-full px-3 py-1 transition-colors ${
              layerKind === 'street'
                ? 'bg-sensu-500 text-white'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            Mapa
          </button>
          <button
            type="button"
            data-testid="map-layer-satellite"
            onClick={() => setLayerKind('satellite')}
            className={`rounded-full px-3 py-1 transition-colors ${
              layerKind === 'satellite'
                ? 'bg-sensu-500 text-white'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            Satélite
          </button>
        </div>
        <style>{`
          .map-center-cross {
            width: 22px;
            height: 22px;
          }
          .map-center-cross::before,
          .map-center-cross::after {
            content: '';
            position: absolute;
            background: #0284c7;
            box-shadow: 0 0 0 1px rgba(255,255,255,0.95);
          }
          .map-center-cross::before {
            top: 50%; left: 0; right: 0;
            height: 1.5px;
            transform: translateY(-50%);
          }
          .map-center-cross::after {
            top: 0; bottom: 0; left: 50%;
            width: 1.5px;
            transform: translateX(-50%);
          }
          .geofence-edit-marker-wrap { background: transparent; border: none; }
          .geofence-edit-marker {
            width: 14px;
            height: 14px;
            border-radius: 9999px;
            background: #ee3a3a;
            border: 2px solid #ffffff;
            box-shadow: 0 1px 4px rgba(15,23,42,0.2);
            cursor: grab;
          }
          .geofence-edit-marker:active { cursor: grabbing; }
          .leaflet-control-attribution {
            font-size: 10px !important;
            background: rgba(255, 255, 255, 0.7) !important;
            backdrop-filter: blur(8px);
          }
          .leaflet-control-attribution a { color: rgb(113, 113, 122) !important; }
          .leaflet-control-zoom {
            border-radius: 9999px !important;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(15,23,42,0.1), 0 4px 12px rgba(15,23,42,0.06) !important;
            border: none !important;
          }
          .leaflet-control-zoom a {
            background: white !important;
            color: rgb(63, 63, 70) !important;
            border: none !important;
          }
          .leaflet-control-zoom a:hover { background: rgb(244, 244, 245) !important; }
        `}</style>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          {geofences.length === 0
            ? 'Aún no tienes geocercas configuradas.'
            : geofences.length === 1
              ? '1 geocerca activa'
              : `${geofences.length} geocercas activas`}
        </p>
        <button
          type="button"
          data-testid="geofence-new"
          onClick={startCreate}
          disabled={!canCreateOnAnyDevice || form?.id === null}
          className="inline-flex items-center gap-1.5 rounded-full bg-sensu-500 px-4 py-2 text-sm font-medium tracking-tight text-white transition-transform hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50 disabled:hover:translate-y-0"
        >
          <LuPlus aria-hidden className="h-4 w-4" />
          Nueva geocerca
        </button>
      </div>

      {form && (
        <section
          ref={formRef}
          data-testid="geofence-form"
          className="card-surface mt-6 rounded-3xl p-6 ring-2 ring-sensu-300 animate-rise"
          aria-label={form.id ? 'Editar geocerca' : 'Nueva geocerca'}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <h3 className="text-base font-semibold tracking-tight text-zinc-900">
              {form.id ? 'Editar geocerca' : 'Nueva geocerca'}
            </h3>
            <button
              type="button"
              data-testid="geofence-form-close"
              onClick={cancelForm}
              aria-label="Cerrar"
              className="-mr-2 -mt-2 inline-flex h-8 w-8 items-center justify-center rounded-full text-sky-500 transition-colors hover:bg-sky-50 hover:text-sky-700"
            >
              <LuX aria-hidden className="h-4 w-4 text-sky-500" />
            </button>
          </div>
          <div data-testid="geofence-form-body">
            <div className="mb-4">
              <span className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                Buscar dirección
              </span>
              <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  type="text"
                  data-testid="geofence-address"
                  value={addressQuery}
                  onChange={(e) => setAddressQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void searchAddress();
                    }
                  }}
                  placeholder="Calle, colonia, hospital…"
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-sensu-400 focus:ring-2 focus:ring-sensu-200 sm:flex-1"
                />
                <button
                  type="button"
                  data-testid="geofence-address-search"
                  onClick={() => void searchAddress()}
                  disabled={addressBusy || addressQuery.trim().length < 3}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-sky-50 px-3 py-2 text-sm font-medium tracking-tight text-sky-700 transition-colors hover:bg-sky-100 disabled:opacity-50 sm:w-auto"
                >
                  <LuSearch aria-hidden className="h-4 w-4 text-sky-500" />
                  {addressBusy ? '…' : 'Buscar'}
                </button>
              </div>
              {addressResults.length > 0 && (
                <ul
                  data-testid="geofence-address-results"
                  className="mt-2 max-h-44 divide-y divide-zinc-100 overflow-y-auto rounded-xl border border-zinc-200 bg-white text-sm shadow-sm"
                >
                  {addressResults.map((r, i) => (
                    <li key={`${r.lat}-${r.lng}-${i}`}>
                      <button
                        type="button"
                        onClick={() => pickAddress(r)}
                        className="block w-full px-3 py-2 text-left text-zinc-700 transition-colors hover:bg-zinc-50"
                      >
                        {r.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-1.5 text-xs text-zinc-500">
                O da clic en el mapa para mover el centro, o arrastra el punto rojo.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm">
                <span className="text-xs uppercase tracking-[0.14em] text-zinc-500">Nombre</span>
                <input
                  type="text"
                  data-testid="geofence-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Casa, Parque, Hospital…"
                  maxLength={80}
                  className="mt-1.5 block w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-sensu-400 focus:ring-2 focus:ring-sensu-200"
                />
              </label>

              <label className="text-sm">
                <span className="text-xs uppercase tracking-[0.14em] text-zinc-500">Dispositivo</span>
                <select
                  data-testid="geofence-device"
                  disabled={form.id !== null}
                  value={form.deviceId}
                  onChange={(e) => setForm({ ...form, deviceId: e.target.value })}
                  className="mt-1.5 block w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-sensu-400 focus:ring-2 focus:ring-sensu-200 disabled:opacity-60"
                >
                  {devices.map((d) => {
                    const used = zonesUsedByDevice.get(d.deviceId) ?? 0;
                    return (
                      <option
                        key={d.deviceId}
                        value={d.deviceId}
                        disabled={form.id === null && used >= 4}
                      >
                        {d.label}
                        {form.id === null && used >= 4 ? ' (4/4 zonas)' : ''}
                      </option>
                    );
                  })}
                </select>
              </label>

              <label className="text-sm">
                <span className="text-xs uppercase tracking-[0.14em] text-zinc-500">Radio (m)</span>
                <input
                  type="number"
                  data-testid="geofence-radius"
                  value={form.radiusMeters}
                  min={20}
                  max={50_000}
                  onChange={(e) => setForm({ ...form, radiusMeters: Number(e.target.value) })}
                  className="mt-1.5 block w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-sensu-400 focus:ring-2 focus:ring-sensu-200"
                />
              </label>

              <label className="text-sm">
                <span className="text-xs uppercase tracking-[0.14em] text-zinc-500">Disparar al</span>
                <select
                  data-testid="geofence-direction"
                  value={form.direction}
                  onChange={(e) => setForm({ ...form, direction: e.target.value as GeofenceDirection })}
                  className="mt-1.5 block w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-sensu-400 focus:ring-2 focus:ring-sensu-200"
                >
                  <option value="BOTH">Entrar y salir</option>
                  <option value="ENTER">Entrar</option>
                  <option value="LEAVE">Salir</option>
                </select>
              </label>
            </div>

            <p className="mt-4 text-xs text-zinc-500">
              Centro:{' '}
              <span
                data-testid="geofence-center"
                className="font-mono tabular-nums"
              >
                {form.centerLat.toFixed(5)}, {form.centerLng.toFixed(5)}
              </span>
            </p>

            {error && (
              <p
                data-testid="geofence-error"
                className="mt-3 text-sm text-rose-700"
              >
                {error}
              </p>
            )}

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                data-testid="geofence-cancel"
                onClick={cancelForm}
                disabled={busy}
                className="inline-flex items-center rounded-full bg-sky-50 px-4 py-2 text-sm font-medium tracking-tight text-sky-700 transition-colors hover:bg-sky-100 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                data-testid="geofence-save"
                onClick={save}
                disabled={busy || form.name.trim().length === 0}
                className="inline-flex items-center gap-1.5 rounded-full bg-sensu-500 px-4 py-2 text-sm font-medium tracking-tight text-white transition-transform hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {busy ? 'Guardando…' : form.id ? 'Guardar cambios' : 'Crear geocerca'}
              </button>
            </div>
          </div>
        </section>
      )}

      <ConfirmModal
        open={pendingDelete !== null}
        title="Eliminar geocerca"
        body={
          pendingDelete
            ? `¿Eliminar la geocerca «${pendingDelete.name}»? Tu Sensu dejará de avisar cuando entre o salga de esta zona.`
            : ''
        }
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        busy={busy}
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (!pendingDelete) return;
          await remove(pendingDelete);
          setPendingDelete(null);
        }}
        testId="geofence-confirm-delete"
        lockBodyScroll={false}
      />

      {geofences.length > 0 && (
        <ul
          data-testid="geofence-list"
          className="card-surface mt-4 divide-y divide-zinc-100 rounded-3xl"
        >
          {geofences.map((g, i) => (
            <li
              key={g.id}
              data-testid={`geofence-${g.id}`}
              className="flex items-center justify-between gap-3 px-5 py-4 animate-rise"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium tracking-tight text-zinc-900">
                  <LuMapPin aria-hidden className="h-4 w-4 text-sensu-500" />
                  <span data-testid={`geofence-${g.id}-name`}>{g.name}</span>
                </p>
                <p className="mt-0.5 truncate text-xs text-zinc-500">
                  {g.deviceLabel} · {g.radiusMeters} m · {DIRECTION_LABEL[g.direction]}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  data-testid={`geofence-${g.id}-edit`}
                  onClick={() => startEdit(g)}
                  disabled={busy}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-sky-500 transition-colors hover:bg-sky-50 hover:text-sky-700"
                  aria-label="Editar geocerca"
                >
                  <LuPencil aria-hidden className="h-4 w-4 text-sky-500" />
                </button>
                <button
                  type="button"
                  data-testid={`geofence-${g.id}-delete`}
                  onClick={() => setPendingDelete(g)}
                  disabled={busy}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-rose-500 transition-colors hover:bg-rose-50 hover:text-rose-700"
                  aria-label="Eliminar geocerca"
                >
                  <LuTrash2 aria-hidden className="h-4 w-4 text-rose-500" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
