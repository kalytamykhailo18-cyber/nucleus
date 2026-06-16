'use client';

import { useEffect, useRef, useState } from 'react';
import L, {
  type Map as LeafletMap,
  type Marker as LeafletMarker,
  type TileLayer as LeafletTileLayer,
} from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LuMapPin } from 'react-icons/lu';
import type { DeviceSummary } from '@/lib/devices';

/**
 * Live device map.
 *
 * Renders one coral pulse marker per device that has a known GPS fix.
 * Devices without a fix don't appear on the map — they show in the
 * `Tus dispositivos` list below with the "Sin contacto" pill, which is
 * the correct user-facing signal: the family member shouldn't see a
 * pretend marker on (0, 0).
 *
 * Engine: Leaflet over MapLibre. Leaflet uses plain `<img>` tags for
 * raster tiles (no WebGL, no canvas, no GPU). Some users were seeing a
 * pure-white map even with valid tile responses — Chromium WebGL on
 * Windows was painting an empty framebuffer in their environment.
 * Leaflet sidesteps the entire WebGL stack and renders everywhere.
 *
 * The component re-renders when `devices` changes (the dashboard polls
 * /api/devices every 5 s). On each re-render we diff the marker set:
 * existing markers slide to their new lng/lat with `setLatLng`, new
 * devices get a fresh marker, devices that lost their fix get their
 * marker removed. The map's bounds re-fit only when the marker count
 * changes — moving an existing marker shouldn't yank the viewport.
 */

type DeviceWithFix = DeviceSummary & { lat: number; lng: number };

function hasFix(d: DeviceSummary): d is DeviceWithFix {
  return d.lat !== null && d.lng !== null;
}

const STREET_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const STREET_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const SATELLITE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const SATELLITE_ATTR = 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community';

// Teardrop pin SVG — `color` fills the body, white stroke + inner dot
// keep it readable against street and satellite tiles. ViewBox is 28×36;
// the tip sits at (14, 35) so the geographic coord aligns with the bottom
// point of the pin (anchor below).
function pinSvg(color: string): string {
  return `<svg viewBox="0 0 28 36" width="28" height="36" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M14 35 C 14 35 26 23 26 13 A 12 12 0 0 0 2 13 C 2 23 14 35 14 35 Z"
          fill="${color}" stroke="white" stroke-width="2"/>
    <circle cx="14" cy="13" r="4.5" fill="white"/>
  </svg>`;
}

export function DeviceMap({ devices }: { devices: DeviceSummary[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, LeafletMarker>>(new Map());
  const userMarkerRef = useRef<LeafletMarker | null>(null);
  const streetLayerRef = useRef<LeafletTileLayer | null>(null);
  const satLayerRef = useRef<LeafletTileLayer | null>(null);
  // Track the previous SET of fixed device IDs so we only fit-bounds when
  // a device joins or leaves — not every 5s when the polling tick brings
  // back the same set with the same coords. The user lost their zoom
  // every cycle until this guard landed.
  const lastIdsRef = useRef<string>('');
  // Once we've fit-bounds to include the user's pin (first arrival),
  // never re-fit on subsequent device polls — the user expects their
  // viewport to stick once they've zoomed/panned.
  const initialFitWithUserDoneRef = useRef(false);
  const [layerKind, setLayerKind] = useState<'street' | 'satellite'>('street');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  const fixed = devices.filter(hasFix);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialCenter: [number, number] =
      fixed.length > 0
        ? [fixed[0]!.lat, fixed[0]!.lng]
        : [19.4326, -99.1332]; // Mexico City — Sensu's home market.

    const map = L.map(containerRef.current, {
      center: initialCenter,
      zoom: fixed.length > 0 ? 14 : 11,
      attributionControl: true,
      zoomControl: true,
      // Wheel zoom + double-click zoom + pinch all on. Page can still
      // scroll past the map because the dashboard isn't long enough for
      // cursor-over-map to trap scrolling — and the family member
      // expects the standard Google-Maps interaction.
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

    mapRef.current = map;
    (window as unknown as { __nucleusMap?: LeafletMap }).__nucleusMap = map;

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      streetLayerRef.current?.remove();
      satLayerRef.current?.remove();
      streetLayerRef.current = null;
      satLayerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bfcache lifecycle. Two coordinated handlers:
  //
  //  - `pagehide` fires when the user navigates away (browser back, tab
  //    close, link click). We proactively tear down the Leaflet map BEFORE
  //    the browser snapshots the page for bfcache. Leaflet schedules
  //    animation frames internally that read `_leaflet_pos` off DOM
  //    children; if we hand the page to bfcache with those frames still
  //    queued, they fire on restoration and throw "Cannot read properties
  //    of undefined (reading '_leaflet_pos')".
  //
  //  - `pageshow.persisted` fires if the browser DID bfcache us anyway and
  //    later restored the page (e.g. user clicks back twice). React state
  //    is preserved across bfcache, so the component never re-mounts —
  //    the safest way to recover is a hard reload, which is sub-second
  //    in practice and invisible to the family member's workflow.
  useEffect(() => {
    const onPageHide = () => {
      const map = mapRef.current;
      if (!map) return;
      try {
        markersRef.current.forEach((m) => m.remove());
        markersRef.current.clear();
        userMarkerRef.current?.remove();
        userMarkerRef.current = null;
        streetLayerRef.current?.remove();
        satLayerRef.current?.remove();
        streetLayerRef.current = null;
        satLayerRef.current = null;
        map.remove();
      } catch {
        /* defensive — Leaflet sometimes throws on its own internal cleanup,
         * we don't care, the page is being unloaded. */
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

  // Swap base layer when the toggle flips. Only one of the two is on the
  // map at any time so MapLibre's tile cache doesn't double-load.
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

  // Ask the browser for the family member's location ONCE on mount. If
  // they decline, the user-pin simply never renders — silence is the
  // correct UX when permission is denied. We don't watch position; this
  // is a "you are here" reference, not a tracking pin.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => { /* denied / unavailable — leave userLocation null */ },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  // Marker diff — runs whenever the device list (from polling) changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const existing = markersRef.current;
    const seen = new Set<string>();

    for (const d of fixed) {
      seen.add(d.deviceId);
      const latLng: [number, number] = [d.lat, d.lng];
      const marker = existing.get(d.deviceId);
      if (marker) {
        marker.setLatLng(latLng);
      } else {
        const icon = L.divIcon({
          className: 'map-marker-wrap',
          html: `<div class="map-pin map-pin-device" data-testid="map-marker-${d.deviceId}" title="${d.label}">${pinSvg('#ff5757')}</div>`,
          iconSize: [28, 36],
          iconAnchor: [14, 35],
        });
        const fresh = L.marker(latLng, { icon, title: d.label }).addTo(map);
        // Double-click on a device pin → fly to it at street-level zoom.
        // Markers stop dblclick from propagating to the map's default
        // double-click-zoom in modern Leaflet, so this doesn't double up.
        fresh.on('dblclick', () => {
          map.flyTo(latLng, 16, { animate: true, duration: 0.6 });
        });
        existing.set(d.deviceId, fresh);
      }
    }
    // Drop markers for devices that lost their fix or were removed.
    for (const [id, marker] of existing.entries()) {
      if (!seen.has(id)) {
        marker.remove();
        existing.delete(id);
      }
    }

    // Fit bounds only when the marker SET changes — when a device joins
    // or leaves. Polling every 5s revisits the same set with possibly-
    // updated coords; re-fitting then yanks the user's zoom mid-glance,
    // which is exactly the behaviour the user pushed back on.
    const currentIds = fixed
      .map((d) => d.deviceId)
      .sort()
      .join('|');
    if (currentIds !== lastIdsRef.current) {
      lastIdsRef.current = currentIds;
      if (fixed.length > 1 && existing.size === fixed.length) {
        const bounds = L.latLngBounds(fixed.map((d) => [d.lat, d.lng]));
        // animate: false — Leaflet's zoom transitionend fires after the
        // pane is removed if the user navigates away mid-animation,
        // throwing "_leaflet_pos against undefined". Snapping the zoom
        // is imperceptible (single-frame) and dodges the race.
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15, animate: false });
      }
    }
  }, [fixed]);

  // User-location pin — sky-blue teardrop, no pulse. Lives on a separate
  // effect so a fresh geolocation result doesn't perturb the device
  // fit-bounds logic, and so a permission flip later still updates.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!userLocation) {
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      return;
    }
    const latLng: [number, number] = [userLocation.lat, userLocation.lng];
    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng(latLng);
      return;
    }
    const icon = L.divIcon({
      className: 'map-marker-wrap',
      html: `<div class="map-pin map-pin-user" data-testid="map-marker-user" title="Tu ubicación">${pinSvg('#0ea5e9')}</div>`,
      iconSize: [28, 36],
      iconAnchor: [14, 35],
    });
    const userMarker = L.marker(latLng, {
      icon,
      title: 'Tu ubicación',
      // Render under device pins so a co-located family member never
      // hides the senior's pin. Marker pane default zIndexOffset is 0;
      // a negative offset slides this marker below the device markers
      // on the same pane.
      zIndexOffset: -100,
    }).addTo(map);
    userMarker.on('dblclick', () => {
      map.flyTo(latLng, 16, { animate: true, duration: 0.6 });
    });
    userMarkerRef.current = userMarker;

    // First time the user pin lands, re-fit bounds so all pins are
    // visible together. This is the "at first, user can see all of
    // location pointers" rule — but only fires once, so a later poll
    // doesn't yank the viewport away from a deliberate zoom.
    if (!initialFitWithUserDoneRef.current && fixed.length > 0) {
      const bounds = L.latLngBounds([
        ...fixed.map((d) => [d.lat, d.lng] as [number, number]),
        latLng,
      ]);
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15, animate: true, duration: 0.6 });
      initialFitWithUserDoneRef.current = true;
    }
  }, [userLocation, fixed]);

  function focusOn(target: { lat: number; lng: number }): void {
    mapRef.current?.flyTo([target.lat, target.lng], 16, {
      animate: true,
      duration: 0.6,
    });
  }

  function fitAllPins(): void {
    const map = mapRef.current;
    if (!map) return;
    const points: [number, number][] = fixed.map((d) => [d.lat, d.lng]);
    if (userLocation) points.push([userLocation.lat, userLocation.lng]);
    if (points.length === 0) return;
    if (points.length === 1) {
      map.flyTo(points[0]!, 14, { animate: true, duration: 0.6 });
      return;
    }
    map.flyToBounds(L.latLngBounds(points), {
      padding: [60, 60],
      maxZoom: 15,
      animate: true,
      duration: 0.6,
    });
  }

  if (fixed.length === 0) {
    return (
      <div
        data-testid="device-map-empty"
        className="card-surface -mx-6 flex h-[66vh] min-h-[360px] flex-col items-center justify-center rounded-none px-8 text-center sm:mx-0 sm:rounded-3xl"
      >
        <LuMapPin aria-hidden className="h-6 w-6 text-sensu-500" />
        <p className="mt-3 text-sm font-medium text-zinc-700">
          Aún no recibimos la ubicación de tu dispositivo.
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          El mapa aparece cuando la Angela reporta su primer GPS.
        </p>
      </div>
    );
  }

  return (
    // z-0 caps Leaflet's internal panes (tiles 200, overlay 400, markers
    //  600, controls 800) inside this stacking context so any modal at
    //  z-1000 in the root context always wins.
    <div
      data-testid="device-map"
      className="card-surface relative z-0 -mx-6 h-[66vh] min-h-[360px] overflow-hidden rounded-none sm:mx-0 sm:rounded-3xl"
    >
      <div ref={containerRef} className="absolute inset-0" />
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
      <div
        data-testid="map-focus-chips"
        className="absolute bottom-3 left-3 z-[900] flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-1 rounded-full bg-white/90 p-1 shadow-[0_1px_3px_rgba(15,23,42,0.10),0_4px_12px_rgba(15,23,42,0.06)] backdrop-blur"
      >
        {fixed.map((d) => (
          <button
            key={d.deviceId}
            type="button"
            data-testid={`map-focus-${d.deviceId}`}
            onClick={() => focusOn(d)}
            title={`Ver ${d.label}`}
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium tracking-tight text-zinc-700 transition-colors hover:bg-zinc-100"
          >
            <span aria-hidden className="h-2 w-2 rounded-full bg-[#ff5757]" />
            <span className="max-w-[120px] truncate">{d.label}</span>
          </button>
        ))}
        {userLocation && (
          <button
            type="button"
            data-testid="map-focus-user"
            onClick={() => focusOn(userLocation)}
            title="Ver tu ubicación"
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium tracking-tight text-zinc-700 transition-colors hover:bg-zinc-100"
          >
            <span aria-hidden className="h-2 w-2 rounded-full bg-[#0ea5e9]" />
            Tú
          </button>
        )}
        <button
          type="button"
          data-testid="map-focus-all"
          onClick={fitAllPins}
          title="Ver todo"
          className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium tracking-tight text-zinc-700 transition-colors hover:bg-zinc-200"
        >
          Ver todo
        </button>
      </div>
      <style>{`
        .map-pin {
          position: relative;
          width: 28px;
          height: 36px;
          cursor: pointer;
        }
        .map-pin svg {
          position: relative;
          z-index: 1;
          filter: drop-shadow(0 2px 4px rgba(15, 23, 42, 0.22));
        }
        /* Device pin — coral with a live pulse halo behind the head, so the
           senior's location reads as actively reporting. */
        .map-pin-device::before {
          content: '';
          position: absolute;
          left: 9px;
          top: 8px;
          width: 10px;
          height: 10px;
          border-radius: 9999px;
          background: rgba(255, 87, 87, 0.55);
          animation: map-pin-pulse 2.4s cubic-bezier(0.32, 0.72, 0, 1) infinite;
        }
        @keyframes map-pin-pulse {
          0%   { transform: scale(1);   opacity: 0.55; }
          70%  { transform: scale(3.2); opacity: 0;    }
          100% { transform: scale(3.2); opacity: 0;    }
        }
        /* User pin — sky-blue, no pulse. The family member is the viewer,
           not the broadcaster. */
        /* Leaflet's default attribution + zoom controls — match the
           Apple-leaning palette so they don't shout. */
        .leaflet-control-attribution {
          font-size: 10px !important;
          background: rgba(255, 255, 255, 0.7) !important;
          backdrop-filter: blur(8px);
        }
        .leaflet-control-attribution a { color: rgb(113, 113, 122) !important; }
        .leaflet-control-zoom {
          border-radius: 9999px !important;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.10), 0 4px 12px rgba(15, 23, 42, 0.06) !important;
          border: none !important;
        }
        .leaflet-control-zoom a {
          background: white !important;
          color: rgb(63, 63, 70) !important;
          border: none !important;
        }
        .leaflet-control-zoom a:hover { background: rgb(244, 244, 245) !important; }
        /* Strip Leaflet's default marker icon shadow / outline that appears
           around our divIcon wrapper. */
        .map-marker-wrap { background: transparent; border: none; }
        /* Same teardrop pin shape on the geofence editor's draggable marker
           lives in geofence-editor.tsx — keep visually consistent there too. */
      `}</style>
    </div>
  );
}
