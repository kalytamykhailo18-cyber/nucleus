/* Sensu Nucleus — service worker.
 *
 * Lives at /sw.js so it can claim the entire origin scope.
 *
 * Responsibilities:
 *   1. push
 *      Receive a JSON-encoded alert payload and render a localized
 *      notification. Supports two payload shapes:
 *        - LEGACY (pre-2026-08 dispatcher):
 *            { type, deviceId, eventId, timestamp }
 *          Rendered with a fixed title from ALERT_LABEL + a device
 *          reference in the body. No action buttons.
 *        - RICH (from Step 4 payload builder onward):
 *            { type, tier, alertId, title, body, url, actions[],
 *              tag, requireInteraction, vibrate }
 *          Rendered with the server-provided title/body, action
 *          buttons (Ya vi, Llamar centro / Abrir, Reconocer), and a
 *          deep-link URL captured on notification data so
 *          `notificationclick` routes to the right place.
 *      Handling both shapes means Step 4 can upgrade the dispatcher
 *      without breaking Step 3's guarantees.
 *
 *   2. notificationclick
 *      No action → focus/open the deep-link URL from payload data.
 *      action=ack → POST the family acknowledgment endpoint and close.
 *      action=operator_ack → POST the operator acknowledgment endpoint.
 *      action=call_center → open a `tel:` URL for the call-center number.
 *      Never throws; every branch is defensive.
 *
 * No fetch caching is wired here. Nucleus is server-rendered and
 * online-only until a deliberate offline strategy lands.
 */

const ALERT_LABEL = {
  sos: 'Alerta SOS',
  fall_detection: 'Caída detectada',
  battery_low: 'Batería baja',
  battery_critical: 'Batería crítica',
  geofence_enter: 'Entró en geocerca',
  geofence_exit: 'Salió de geocerca',
  button_press: 'Botón lateral',
  offline: 'Pendant sin conexión',
};

const CALL_CENTER_TEL = 'tel:8000570180';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

/**
 * Build a Notification (title + options) from a raw push payload.
 * Extracted as a pure function so both the push handler and the
 * E2E message-handler seam route through the same logic. Never
 * throws — malformed input degrades to a generic "Nueva alerta".
 */
function buildNotificationFromRaw(raw) {
  let payload = {};
  if (typeof raw === 'string') {
    try {
      payload = JSON.parse(raw);
    } catch (err) {
      payload = { type: 'alert' };
    }
  } else if (raw && typeof raw === 'object') {
    payload = raw;
  }

  const isRich = typeof payload.tier === 'string';
  const title = isRich
    ? payload.title || ALERT_LABEL[payload.type] || 'Nueva alerta de Sensu'
    : ALERT_LABEL[payload.type] || 'Nueva alerta de Sensu';
  const body = isRich
    ? payload.body || 'Abre el panel para ver el detalle.'
    : payload.deviceId
      ? `Dispositivo ${payload.deviceId}`
      : 'Abre el panel para ver el detalle.';
  const tag =
    payload.tag ||
    payload.alertId ||
    payload.eventId ||
    'sensu-alert';
  const url = isRich ? payload.url || '/app' : '/dashboard';
  const actions = Array.isArray(payload.actions) ? payload.actions : [];
  const vibrate = Array.isArray(payload.vibrate) ? payload.vibrate : undefined;
  const requireInteraction =
    typeof payload.requireInteraction === 'boolean'
      ? payload.requireInteraction
      : payload.type === 'sos' || payload.type === 'fall_detection';
  // Standard-tier alerts (battery, geofence, offline) render without
  // any OS sound so a routine ping never mimics the alarm reserved
  // for SOS + fall (Juan 2026-08-07). Critical-tier alerts default
  // to noisy — the server sets `silent: false` explicitly on those.
  const silent =
    typeof payload.silent === 'boolean'
      ? payload.silent
      : payload.tier === 'standard';

  const options = {
    body,
    icon: '/icon1',
    badge: '/icon1',
    tag,
    data: {
      url,
      alertId: payload.alertId || payload.eventId || null,
      type: payload.type || null,
      tier: payload.tier || null,
    },
    requireInteraction,
    silent,
  };
  if (actions.length > 0) options.actions = actions;
  if (vibrate) options.vibrate = vibrate;

  return { title, options };
}

/**
 * Silent-ack side of the push contract (Step 6).
 *
 * When a peer subscription taps "Ya vi" the server fans a
 * `type: 'silent_ack'` push here. We do NOT call showNotification —
 * we close any active notification whose tag matches the alertId
 * (so the second phone stops buzzing the moment the first phone
 * acks), then postMessage every open app tab so the active-alert
 * banner clears without a manual refresh.
 *
 * Returns true when handled, false when it was a regular alert
 * payload the caller should render normally.
 */
async function handleSilentAck(raw) {
  let payload = null;
  try {
    payload = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (err) {
    return false;
  }
  if (!payload || payload.type !== 'silent_ack') return false;
  const tag = payload.tag || payload.alertId;
  if (tag) {
    try {
      const matches = await self.registration.getNotifications({ tag });
      for (const n of matches) {
        try {
          n.close();
        } catch (err) {
          // ignore close failures — the notification may already be gone
        }
      }
    } catch (err) {
      // getNotifications is not universal on older SWs — degrade to no-op
    }
  }
  try {
    const clients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });
    for (const client of clients) {
      client.postMessage({
        type: 'sensu:silent-ack',
        alertId: payload.alertId,
        ackSource: payload.ackSource || null,
      });
    }
  } catch (err) {
    // matchAll rarely fails but never let it break the SW
  }
  return true;
}

self.addEventListener('push', (event) => {
  const raw = event.data ? event.data.text() : null;
  event.waitUntil(
    (async () => {
      const handled = await handleSilentAck(raw);
      if (handled) return;
      const { title, options } = buildNotificationFromRaw(raw);
      await self.registration.showNotification(title, options);
    })(),
  );
});

/**
 * E2E test seam.
 *
 * Playwright cannot easily push through a real push service in
 * headless Chromium, so specs use `postMessage` to ask the active SW
 * to compute the notification for a given payload. The SW replies
 * on the message port with the same { title, options } shape the
 * production `push` listener would use.
 *
 * Only responds to the exact type string; every other message is a
 * no-op so this handler cannot be repurposed for anything else.
 */
self.addEventListener('message', (event) => {
  // Step 9 seam: the update-available toast posts this to the waiting
  // worker so it activates immediately on the next controllerchange
  // and the page reloads onto the fresh assets. No-op when this SW
  // is already the active controller.
  if (event.data && event.data.type === 'sensu:sw-skip-waiting') {
    try {
      self.skipWaiting();
    } catch (err) {
      // ignore — skipWaiting throws only when called too late
    }
    return;
  }
  if (!event.data || event.data.type !== 'sensu:test-build-notification') return;
  const built = buildNotificationFromRaw(event.data.payload);
  if (event.ports && event.ports[0]) {
    event.ports[0].postMessage(built);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const action = event.action || null;
  const data = event.notification.data || {};

  // Family acknowledgment: POST to the ack endpoint, then close.
  // Operator acknowledgment: POST to the operator ack endpoint.
  // Both endpoints land in Step 6; for now the SW attempts them
  // defensively so an early tap does not silently do nothing.
  if (action === 'ack' && data.alertId) {
    event.waitUntil(
      fetch(
        `/api/alerts/${encodeURIComponent(data.alertId)}/family-ack?source=notification`,
        { method: 'POST', credentials: 'include' },
      ).catch(() => undefined),
    );
    return;
  }
  if (action === 'operator_ack' && data.alertId) {
    event.waitUntil(
      fetch(
        `/api/alerts/${encodeURIComponent(data.alertId)}/operator-ack?source=notification`,
        { method: 'POST', credentials: 'include' },
      ).catch(() => undefined),
    );
    return;
  }
  if (action === 'call_center') {
    event.waitUntil(
      (async () => {
        if (self.clients.openWindow) {
          await self.clients.openWindow(CALL_CENTER_TEL);
        }
      })(),
    );
    return;
  }

  // Default click (no action): focus an existing app tab whose URL
  // starts with the deep-link's pathname, or open a new one.
  const url = data.url || '/app';
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      const targetPath = new URL(url, self.location.origin).pathname;
      for (const client of all) {
        try {
          const clientPath = new URL(client.url).pathname;
          if (clientPath.startsWith(targetPath) || targetPath.startsWith(clientPath)) {
            client.focus();
            client.postMessage({ type: 'sensu:navigate', url });
            return;
          }
        } catch (err) {
          // ignore malformed client URLs
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(url);
      }
    })(),
  );
});
