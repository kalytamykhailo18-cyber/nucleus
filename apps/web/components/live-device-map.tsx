'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import type { DeviceSummary } from '@/lib/devices';

// Leaflet touches `window` at module-load time, so DeviceMap must skip
// SSR. Now that the wrapper is a client component, next/dynamic with
// ssr:false defers the import until after hydration in the browser.
const DeviceMap = dynamic(
  () => import('./device-map').then((m) => m.DeviceMap),
  { ssr: false },
);

/**
 * Polling wrapper around <DeviceMap>. Fetches /api/devices every 5
 * seconds so the marker on the family member's screen catches up with
 * MQTT location updates within the Step-7 acceptance window.
 *
 * Initial render is hydrated from the server-fetched list so the map
 * paints immediately — no spinner, no first-paint flash.
 *
 * Polling is paused when the page is hidden (background tab) so we
 * don't hammer the API while no one is watching.
 */

const POLL_INTERVAL_MS = 5_000;

export function LiveDeviceMap({
  initialDevices,
}: {
  initialDevices: DeviceSummary[];
}) {
  const [devices, setDevices] = useState<DeviceSummary[]>(initialDevices);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async (): Promise<void> => {
      if (typeof document !== 'undefined' && document.hidden) {
        timer = setTimeout(tick, POLL_INTERVAL_MS);
        return;
      }
      try {
        const res = await fetch('/api/devices', { cache: 'no-store' });
        if (!cancelled && res.ok) {
          const body = (await res.json()) as { devices: DeviceSummary[] };
          setDevices(body.devices);
        }
      } catch {
        // Network blip — try again on next tick.
      }
      if (!cancelled) timer = setTimeout(tick, POLL_INTERVAL_MS);
    };

    timer = setTimeout(tick, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  return <DeviceMap devices={devices} />;
}
