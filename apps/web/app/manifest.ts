import type { MetadataRoute } from 'next';

/**
 * PWA web manifest (Juan 2026-06-15).
 *
 * Makes app.sensu.com.mx installable on iOS Safari and Android Chrome.
 * Once "Added to Home Screen" the app opens in standalone mode (no
 * browser chrome), uses the coral Sensu icon, and reuses the existing
 * service worker (/sw.js) for push notifications.
 *
 * Theme + background match the rest of the chrome: coral accent on a
 * cool-gray Apple-style page (#f5f5f7).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Sensu — Monitoreo 24/7',
    short_name: 'Sensu',
    description:
      'Sensu Angela — botón SOS, GPS y centro de asistencia humano 24/7 para tu familiar.',
    start_url: '/app',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f5f5f7',
    theme_color: '#ff5757',
    lang: 'es-MX',
    dir: 'ltr',
    categories: ['health', 'lifestyle', 'medical'],
    icons: [
      {
        src: '/icon1',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon2',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon2',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
