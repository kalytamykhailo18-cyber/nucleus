'use client';

import dynamic from 'next/dynamic';
import type { FleetDevice } from '@/lib/fleet-map';

/**
 * /company fleet map (Medtronic ask 2026-06-19). Thin wrapper around
 * the admin /admin/fleet map — same Leaflet client, same pin shape,
 * same satellite-vs-street toggle — but mounted under the HR-lead's
 * view of /company. The popup inside FleetMapClient still links to
 * /admin/devices/[imei], which is admin-only; on the customer side
 * that link 403s cleanly. The pins themselves are the value here —
 * the HR lead sees every worker's current position at a glance and
 * pivots to the alert detail on the member card below.
 *
 * Leaflet touches window at module-load time, so the map skips SSR.
 * /company/page.tsx is a server component and Next disallows
 * ssr:false from server components, so this thin client wrapper
 * carries the dynamic import.
 */
const FleetMapClient = dynamic(
  () =>
    import('@/app/admin/fleet/fleet-map-client').then((m) => m.FleetMapClient),
  { ssr: false },
);

export function CompanyFleetMapLoader({
  members,
}: {
  members: FleetDevice[];
}): React.ReactElement {
  // Juan 2026-06-23 (D.1a): HR leads click pins to see where the
  // worker is, NOT to drill into our admin device-timeline page.
  // Routing the popup to Google Maps is the right destination
  // for that audience.
  return <FleetMapClient devices={members} popupBehavior="maps" />;
}
