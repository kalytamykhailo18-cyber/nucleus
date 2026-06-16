/* Sensu Nucleus — service worker.
 *
 * Lives at /sw.js so it can claim the entire origin scope. Two jobs:
 *
 *   1. push     — receive a JSON-encoded alert, render a localized
 *                 notification (title + body + icon).
 *   2. notificationclick
 *               — open the dashboard or focus an existing tab so the
 *                 family member lands on the alerts feed in one tap.
 *
 * No service-worker-side fetch interception, no offline cache. Nucleus
 * is server-rendered and online-only; an SW that intercepts fetch would
 * be a footgun before we have a deliberate offline strategy.
 */

const ALERT_LABEL = {
  sos: 'Alerta SOS',
  fall_detection: 'Caída detectada',
  battery_low: 'Batería baja',
  geofence_enter: 'Entró en geocerca',
  geofence_exit: 'Salió de geocerca',
  button_press: 'Botón lateral',
};

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { type: 'alert' };
    }
  }
  const title = ALERT_LABEL[payload.type] || 'Nueva alerta de Sensu';
  const body = payload.deviceId
    ? `Dispositivo ${payload.deviceId}`
    : 'Abre el panel para ver el detalle.';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: payload.eventId || 'sensu-alert',
      data: { url: '/dashboard', eventId: payload.eventId || null },
      requireInteraction: payload.type === 'sos',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/dashboard';

  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of all) {
        if (new URL(client.url).pathname.startsWith('/dashboard')) {
          client.focus();
          return;
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(url);
      }
    })(),
  );
});
