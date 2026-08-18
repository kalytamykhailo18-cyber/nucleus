/**
 * Sensu Nucleus — MQTT subscriber.
 *
 * Connects to the Eview cloud broker, subscribes to every device topic
 * under `EVIEW_PRODUCT_ID`, and persists alerts to the same `EviewEvent`
 * table the Python subscriber in `sensu-api` writes to. Identical row
 * shape — Step 14 will run a parity comparator before we retire the
 * Python side.
 *
 * Connection model: durable client with auto-reconnect on broker drops,
 * QoS 1 subscriptions so the broker re-delivers anything missed during
 * a reconnect. Process exits cleanly on SIGINT / SIGTERM.
 */

import mqtt from 'mqtt';
import { PrismaClient } from '@prisma/client';
import { env } from './env';
import { classify, parseTopic } from './alarm';
import { saveEviewEvent } from './save-event';
import { dispatchAlertPush } from './push';
import { startDripTick } from './drip-tick';
import { startStripeCleanupTick } from './stripe-cleanup-tick';
import { startReferralExpirationTick } from './referral-expiration-tick';
import { startRenewalTick } from './renewal-tick';

// Event types that trigger a push notification. Mirrors the web app's
// ALERT_EVENT_TYPES list — keep in sync if you add an alert class.
const PUSH_TRIGGERING_TYPES = new Set([
  'sos',
  'fall_detection',
  'battery_low',
  'geofence_enter',
  'geofence_exit',
  'button_press',
]);

// Subset of PUSH_TRIGGERING_TYPES that must fire a push even when the
// 180 s dedup window swallows the row (Juan 2026-08-07). A family
// member in distress presses the SOS repeatedly because they hear
// nothing; the system must buzz their family's phones every time,
// even if the alerts feed only shows the first row.
const CRITICAL_PUSH_TYPES = new Set(['sos', 'fall_detection']);

const prisma = new PrismaClient();
const startedAt = new Date();
let receivedCount = 0;
let savedCount = 0;
let dedupedCount = 0;
let failedCount = 0;

function log(level: 'info' | 'warn' | 'error', msg: string, extra?: Record<string, unknown>): void {
  const line = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...extra,
  };
  // One JSON object per line — friendly to docker logs / awslogs / jq.
  console.log(JSON.stringify(line));
}

async function handleMessage(topic: string, raw: Buffer): Promise<void> {
  receivedCount += 1;
  const parsed = parseTopic(topic);
  if (!parsed.deviceId || !parsed.eventType) {
    log('warn', 'unparseable topic', { topic });
    return;
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw.toString('utf8')) as Record<string, unknown>;
  } catch (err) {
    failedCount += 1;
    log('error', 'json parse failed', {
      topic,
      error: err instanceof Error ? err.message : String(err),
      preview: raw.toString('utf8').slice(0, 200),
    });
    return;
  }

  const classified = classify(parsed.eventType, payload);
  if (!classified.persist) {
    return;
  }

  const timestamp =
    typeof payload.timestamp === 'number'
      ? new Date(payload.timestamp)
      : new Date();

  try {
    const result = await saveEviewEvent(prisma, {
      deviceId: parsed.deviceId,
      eventType: classified.eventType,
      timestamp,
      buttonType: classified.buttonType,
      payload,
    });
    if (result.id) {
      savedCount += 1;
      log('info', 'event saved', {
        deviceId: parsed.deviceId,
        eventType: classified.eventType,
        eventId: result.id,
      });

      // Fan out web push to every family member tied to this device.
      // Best-effort — failures here never roll back the alert save.
      if (PUSH_TRIGGERING_TYPES.has(classified.eventType)) {
        try {
          const attempts = await dispatchAlertPush(prisma, parsed.deviceId, {
            type: classified.eventType,
            deviceId: parsed.deviceId,
            eventId: result.id,
            timestamp: timestamp.toISOString(),
          });
          if (attempts > 0) {
            log('info', 'push dispatched', {
              eventId: result.id,
              attempts,
            });
          }
        } catch (err) {
          log('error', 'push dispatch crashed', {
            eventId: result.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      // Note: Aura escalation does not pass through the worker or any
      // Sensu API. The call-center is the human triage layer — after
      // reviewing the caller-ID payload, the operator phones Aura at
      // +52 55 9562 1829 (rendered in the operator modal). The senior
      // side hits Aura's own API directly from the Sensu mobile app.
    } else {
      dedupedCount += 1;
      log('info', 'event deduped', {
        deviceId: parsed.deviceId,
        eventType: classified.eventType,
      });

      // Critical override (Juan 2026-08-07): the 180 s dedup window
      // exists so Eview device retransmits do not stack duplicate
      // rows in the feed. That's fine for row storage but LIFE
      // THREATENING for SOS + fall — a family member in distress
      // presses the button repeatedly because they hear nothing,
      // and the system silently swallowed presses 2, 3, 4… Fix:
      // dedup the DB row as before, but ALWAYS fire a push on
      // critical types using the original (non-deduped) event's
      // id so the notification pipeline treats it as one logical
      // alert while still buzzing the family's phone every time
      // the button is pressed.
      if (CRITICAL_PUSH_TYPES.has(classified.eventType)) {
        try {
          const original = await prisma.eviewEvent.findFirst({
            where: {
              eviewDeviceId: parsed.deviceId,
              eventType: classified.eventType,
              timestamp: {
                gte: new Date(timestamp.getTime() - 180_000),
                lte: new Date(timestamp.getTime() + 5_000),
              },
            },
            orderBy: { timestamp: 'desc' },
            select: { id: true },
          });
          if (original) {
            const attempts = await dispatchAlertPush(prisma, parsed.deviceId, {
              type: classified.eventType,
              deviceId: parsed.deviceId,
              eventId: original.id,
              timestamp: timestamp.toISOString(),
            });
            if (attempts > 0) {
              log('info', 'push re-dispatched on dedup', {
                eventId: original.id,
                eventType: classified.eventType,
                attempts,
              });
            }
          } else {
            log('warn', 'critical dedup with no original found', {
              deviceId: parsed.deviceId,
              eventType: classified.eventType,
            });
          }
        } catch (err) {
          log('error', 'critical dedup re-dispatch failed', {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
  } catch (err) {
    failedCount += 1;
    log('error', 'event save failed', {
      deviceId: parsed.deviceId,
      eventType: classified.eventType,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

function logHealthEvery(ms: number): NodeJS.Timeout {
  return setInterval(() => {
    log('info', 'health', {
      uptimeSec: Math.round((Date.now() - startedAt.getTime()) / 1000),
      received: receivedCount,
      saved: savedCount,
      deduped: dedupedCount,
      failed: failedCount,
    });
  }, ms);
}

async function main(): Promise<void> {
  const url = `mqtt://${env.EVIEW_MQTT_HOST}:${env.EVIEW_MQTT_PORT}`;
  const productId = env.EVIEW_PRODUCT_ID;

  log('info', 'connecting', {
    url,
    clientId: env.EVIEW_MQTT_CLIENT_ID,
    productId,
  });

  const client = mqtt.connect(url, {
    clientId: env.EVIEW_MQTT_CLIENT_ID,
    username: env.EVIEW_MQTT_USERNAME,
    password: env.EVIEW_MQTT_PASSWORD,
    keepalive: 60,
    reconnectPeriod: 5_000,
    connectTimeout: 10_000,
    clean: true,
    protocolVersion: 4,
  });

  const wildcards = [
    `/device/${productId}/+/message/#`,
    '/device/+/+/message/#',
  ];

  client.on('connect', () => {
    log('info', 'connected');
    for (const topic of wildcards) {
      client.subscribe(topic, { qos: 1 }, (err) => {
        if (err) {
          log('error', 'subscribe failed', { topic, error: err.message });
        } else {
          log('info', 'subscribed', { topic });
        }
      });
    }
  });

  client.on('reconnect', () => log('info', 'reconnecting'));
  client.on('close', () => log('warn', 'connection closed'));
  client.on('error', (err) => log('error', 'mqtt error', { error: err.message }));
  client.on('offline', () => log('warn', 'broker offline'));

  client.on('message', (topic, payload) => {
    // Don't await — message handling runs in parallel; errors are logged inside.
    handleMessage(topic, payload).catch((err) => {
      failedCount += 1;
      log('error', 'unexpected handler error', {
        topic,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  });

  const healthTimer = logHealthEvery(5 * 60 * 1000);
  // Drip-email scheduler — fires every 10 minutes against
  // nucleus-web's /api/jobs/drip-tick. Returns null if
  // E2E_HOOKS_SECRET is unset (no-op in dev / staging without the
  // shared secret), otherwise a clearable interval handle.
  const dripTimer = startDripTick({
    info: (msg, extra) => log('info', msg, extra),
    warn: (msg, extra) => log('warn', msg, extra),
    error: (msg, extra) => log('error', msg, extra),
  });

  // Stripe Incompleto sweep — hourly POST to /api/jobs/stripe-cleanup-tick
  // that cancels stale unconfirmed PaymentIntents (>24 h old, carrying
  // nucleusSubscriptionId metadata). Keeps Juan's default Pagos view
  // free of abandoned-checkout rows.
  const stripeCleanupTimer = startStripeCleanupTick({
    info: (msg, extra) => log('info', msg, extra),
    warn: (msg, extra) => log('warn', msg, extra),
    error: (msg, extra) => log('error', msg, extra),
  });

  // Referral expiration sweep — daily POST to
  // /api/jobs/referral-expiration-tick that flips PENDING referrals
  // older than 90 days to EXPIRED. Keeps the admin reporting panel
  // honest and frees referrers to share their code with someone new.
  const referralExpirationTimer = startReferralExpirationTick({
    info: (msg, extra) => log('info', msg, extra),
    warn: (msg, extra) => log('warn', msg, extra),
    error: (msg, extra) => log('error', msg, extra),
  });

  // Renewal worker — hourly POST to /api/jobs/renewal-tick. Three
  // phases per tick: send 7-day-out reminders, attempt off-session
  // charges on due subscriptions, promote PAST_DUE rows to CANCELLED
  // after their grace window expires. Drives the full recurring
  // revenue loop without manual intervention.
  const renewalTimer = startRenewalTick({
    info: (msg, extra) => log('info', msg, extra),
    warn: (msg, extra) => log('warn', msg, extra),
    error: (msg, extra) => log('error', msg, extra),
  });

  const shutdown = async (signal: string): Promise<void> => {
    log('info', 'shutting down', { signal });
    clearInterval(healthTimer);
    if (dripTimer) clearInterval(dripTimer);
    if (stripeCleanupTimer) clearInterval(stripeCleanupTimer);
    if (referralExpirationTimer) clearInterval(referralExpirationTimer);
    if (renewalTimer) clearInterval(renewalTimer);
    await new Promise<void>((resolve) => {
      client.end(false, {}, () => resolve());
    });
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  log('error', 'fatal startup error', {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  process.exit(1);
});
