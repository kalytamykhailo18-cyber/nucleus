'use client';

import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import type { DeviceTimelineGpsPoint } from '@/lib/device-timeline';

/**
 * GPS trail for a single device. The most recent point gets a pulsed
 * coral marker, the rest of the trail is drawn as a thin sensu-tinted
 * polyline so the call-center can see where the senior has been over
 * the recent past at a glance.
 *
 * Leaflet is imported dynamically inside useEffect so the module never
 * evaluates `window` server-side — the file is still a client
 * component, but the Leaflet top-level code only runs once we're in
 * the browser.
 */
export function DeviceTimelineMap({
  points,
}: {
  points: DeviceTimelineGpsPoint[];
}): React.ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<unknown>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) return;
    if (points.length === 0) return;

    let disposed = false;
    let teardown: (() => void) | null = null;

    void import('leaflet').then(({ default: L }) => {
      if (disposed || !containerRef.current) return;
      const map = L.map(containerRef.current, {
        preferCanvas: false,
        attributionControl: true,
      });
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // Trail goes oldest → newest visually; the data is newest-first.
      const latlngs: [number, number][] = points
        .slice()
        .reverse()
        .map((p) => [p.lat, p.lng]);

      L.polyline(latlngs, {
        color: '#f43f5e',
        weight: 3,
        opacity: 0.75,
      }).addTo(map);

      // Pulsed coral pin on the latest fix.
      const latest = points[0];
      L.marker([latest.lat, latest.lng]).addTo(map).bindPopup(
        `<b>Última señal</b><br/>${new Date(latest.timestamp).toLocaleString(
          'es-MX',
          { timeZone: 'America/Mexico_City' },
        )}`,
      );

      // Smaller dots on the rest of the trail so each ping is visible.
      for (const p of points.slice(1)) {
        L.circleMarker([p.lat, p.lng], {
          radius: 4,
          color: '#f43f5e',
          weight: 1,
          opacity: 0.6,
          fillColor: '#fff',
          fillOpacity: 0.9,
        }).addTo(map);
      }

      map.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40] });

      teardown = () => {
        map.remove();
      };
    });

    return () => {
      disposed = true;
      if (teardown) teardown();
      mapRef.current = null;
    };
  }, [points]);

  return (
    <div
      ref={containerRef}
      data-testid="admin-device-timeline-map"
      className="mt-4 h-[420px] w-full rounded-3xl ring-1 ring-zinc-200/70"
    />
  );
}
