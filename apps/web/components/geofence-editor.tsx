'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';
import type { GeofenceEditor as GeofenceEditorImpl } from './geofence-editor-impl';

/**
 * Thin dynamic-import wrapper around the real GeofenceEditor. The impl
 * file imports Leaflet, which touches `window` at module-load time and
 * blows up server-side rendering with
 * `ReferenceError: window is not defined`. Even though the impl is
 * marked `'use client'`, Next's code-splitting still pulls its chunk
 * into the server bundle for any server route that references it (and
 * /geofences is server-rendered). next/dynamic with `ssr: false`
 * defers the import until the browser, so the server chunk no longer
 * tries to evaluate Leaflet during render.
 *
 * Mirrors the same shape live-device-map.tsx uses for the dashboard's
 * MapLibre/Leaflet wrapper.
 */
const LazyGeofenceEditor = dynamic(
  () => import('./geofence-editor-impl').then((m) => m.GeofenceEditor),
  { ssr: false },
);

export function GeofenceEditor(
  props: ComponentProps<typeof GeofenceEditorImpl>,
): React.ReactElement {
  return <LazyGeofenceEditor {...props} />;
}
