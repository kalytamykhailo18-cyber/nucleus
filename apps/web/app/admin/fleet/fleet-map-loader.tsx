'use client';

import dynamic from 'next/dynamic';
import type { FleetDevice } from '@/lib/fleet-map';

// Leaflet touches `window` at module-load time, so the fleet map has
// to skip SSR. /admin/fleet/page.tsx is a server component and Next.js
// disallows ssr:false from server components, so this thin client
// wrapper carries the dynamic import.
const FleetMapClient = dynamic(
  () => import('./fleet-map-client').then((m) => m.FleetMapClient),
  { ssr: false },
);

export function FleetMapLoader({
  devices,
}: {
  devices: FleetDevice[];
}): React.ReactElement {
  return <FleetMapClient devices={devices} />;
}
