/**
 * Web push dispatcher — fires VAPID-signed pushes to every subscription
 * for every user that owns the device an alert just landed on.
 *
 * Behaviour:
 *  - When VAPID keys are missing (local dev or first-boot before keys
 *    land), the dispatcher logs and no-ops. The alert still saved.
 *  - On 410 Gone or 404 from the push service: subscription is dead,
 *    delete it.
 *  - On other 4xx/5xx: increment failedCount; once it crosses 5 the row
 *    is deleted. Web push services drop receivers eventually anyway.
 *  - When E2E_HOOKS_SECRET is set: every dispatch attempt also writes a
 *    PushOutboxTest row so Playwright can verify without a real push
 *    round-trip. Subscriptions whose endpoint contains `nucleus-test`
 *    skip the real web-push call entirely (they're synthetic).
 *
 * The function is best-effort and never throws upstream — alert
 * persistence already happened, push is the bonus channel.
 */

import type { PrismaClient } from '@prisma/client';
import webPush from 'web-push';
import { env } from './env';

export interface AlertPushPayload {
  type: string;          // 'sos' | 'fall_detection' | ...
  deviceId: string;
  eventId: string;
  timestamp: string;     // ISO 8601
}

const FAIL_PRUNE_AFTER = 5;
const TEST_ENDPOINT_MARKER = 'nucleus-test';

let vapidConfigured = false;
function ensureVapid(): boolean {
  if (vapidConfigured) return true;
  const pub = env.VAPID_PUBLIC_KEY;
  const priv = env.VAPID_PRIVATE_KEY;
  const subj = env.VAPID_SUBJECT;
  if (!pub || !priv || !subj) return false;
  webPush.setVapidDetails(subj, pub, priv);
  vapidConfigured = true;
  return true;
}

interface SubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  failedCount: number;
}

function log(level: 'info' | 'warn' | 'error', msg: string, extra: Record<string, unknown> = {}): void {
  const line = { ts: new Date().toISOString(), level, msg, src: 'push', ...extra };
  console.log(JSON.stringify(line));
}

async function pruneSubscription(prisma: PrismaClient, subId: string, reason: string): Promise<void> {
  await prisma.pushSubscription.deleteMany({ where: { id: subId } });
  log('info', 'subscription pruned', { subId, reason });
}

async function bumpFailure(prisma: PrismaClient, sub: SubscriptionRow): Promise<void> {
  const next = sub.failedCount + 1;
  if (next >= FAIL_PRUNE_AFTER) {
    await pruneSubscription(prisma, sub.id, 'failedCount threshold');
    return;
  }
  await prisma.pushSubscription.update({
    where: { id: sub.id },
    data: { failedCount: next },
  });
}

async function captureToOutbox(
  prisma: PrismaClient,
  userId: string,
  endpoint: string,
  payload: AlertPushPayload,
): Promise<void> {
  if (!env.E2E_HOOKS_SECRET) return;
  await prisma.pushOutboxTest.create({
    data: {
      userId,
      endpoint,
      payloadJson: payload as unknown as object,
    },
  });
}

/**
 * Fan out a push to every user that owns the given device.
 * Returns the number of dispatch attempts (success or failure) — handy
 * for tests and for the worker's per-message log line.
 */
export async function dispatchAlertPush(
  prisma: PrismaClient,
  deviceId: string,
  payload: AlertPushPayload,
): Promise<number> {
  const userDevices = await prisma.userDevice.findMany({
    where: { eviewDeviceId: deviceId },
    select: { userId: true },
  });
  if (userDevices.length === 0) return 0;
  const userIds = [...new Set(userDevices.map((ud) => ud.userId))];

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: { in: userIds } },
    select: {
      id: true,
      userId: true,
      endpoint: true,
      p256dh: true,
      auth: true,
      failedCount: true,
    },
  });
  if (subscriptions.length === 0) return 0;

  const haveVapid = ensureVapid();
  let attempts = 0;

  await Promise.all(
    subscriptions.map(async (sub) => {
      attempts += 1;
      // Test seam: synthetic subscriptions never touch the real push
      // service. This keeps Playwright deterministic — no FCM round-trip,
      // no flaky network.
      const isTest = sub.endpoint.includes(TEST_ENDPOINT_MARKER);

      try {
        await captureToOutbox(prisma, sub.userId, sub.endpoint, payload);
        if (!haveVapid || isTest) {
          await prisma.pushSubscription.update({
            where: { id: sub.id },
            data: { lastSentAt: new Date(), failedCount: 0 },
          });
          return;
        }
        await webPush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload),
          { TTL: 60 },
        );
        await prisma.pushSubscription.update({
          where: { id: sub.id },
          data: { lastSentAt: new Date(), failedCount: 0 },
        });
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await pruneSubscription(prisma, sub.id, `push service ${status}`);
          return;
        }
        log('warn', 'push send failed', {
          subId: sub.id,
          endpoint: sub.endpoint.slice(0, 80),
          status,
          error: err instanceof Error ? err.message : String(err),
        });
        await bumpFailure(prisma, sub);
      }
    }),
  );

  return attempts;
}
