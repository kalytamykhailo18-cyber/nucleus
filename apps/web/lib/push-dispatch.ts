/**
 * Web-app-side dispatcher.
 *
 * Mirrors `apps/worker/src/push.ts` so dev-seam calls (POST seed-alert
 * with `dispatchPush: true`) and Step 13 admin "send test alert" can
 * fire pushes from the web process without round-tripping MQTT.
 *
 * Shared behaviour:
 *  - VAPID keys missing → no-op + capture to outbox if E2E hooks are on.
 *  - 404 / 410 from the push service → prune the subscription.
 *  - Other failures → bump `failedCount`, prune at threshold.
 *  - Endpoints containing `nucleus-test` skip the real push call (used
 *    by Playwright's seeded synthetic subscriptions).
 *
 * Two copies sound bad, but the file is small (~80 lines), the logic
 * rarely changes, and a shared package would add a build step that
 * Phase A doesn't need yet. Promote to a workspace package once a third
 * caller appears.
 */

import webPush from 'web-push';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';

export interface AlertPushPayload {
  type: string;
  deviceId: string;
  eventId: string;
  timestamp: string;
}

const FAIL_PRUNE_AFTER = 5;
const TEST_ENDPOINT_MARKER = 'nucleus-test';

let vapidConfigured = false;
function ensureVapid(): boolean {
  if (vapidConfigured) return true;
  const pub = process.env.NUCLEUS_VAPID_PUBLIC_KEY;
  const priv = process.env.NUCLEUS_VAPID_PRIVATE_KEY;
  const subj = process.env.NUCLEUS_VAPID_SUBJECT;
  if (!pub || !priv || !subj) return false;
  webPush.setVapidDetails(subj, pub, priv);
  vapidConfigured = true;
  return true;
}

export async function dispatchAlertPush(
  deviceId: string,
  payload: AlertPushPayload,
): Promise<number> {
  const userDevices = await prisma.userDevice.findMany({
    where: { eviewDeviceId: deviceId },
    select: { userId: true },
  });
  if (userDevices.length === 0) return 0;
  const userIds = [...new Set(userDevices.map((ud) => ud.userId))];

  const subs = await prisma.pushSubscription.findMany({
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
  if (subs.length === 0) return 0;

  const haveVapid = ensureVapid();
  const captureOutbox = !!env.E2E_HOOKS_SECRET;
  let attempts = 0;

  await Promise.all(
    subs.map(async (sub) => {
      attempts += 1;
      const isTest = sub.endpoint.includes(TEST_ENDPOINT_MARKER);

      try {
        if (captureOutbox) {
          await prisma.pushOutboxTest.create({
            data: {
              userId: sub.userId,
              endpoint: sub.endpoint,
              payloadJson: payload as unknown as object,
            },
          });
        }
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
          await prisma.pushSubscription.deleteMany({ where: { id: sub.id } });
          return;
        }
        const next = sub.failedCount + 1;
        if (next >= FAIL_PRUNE_AFTER) {
          await prisma.pushSubscription.deleteMany({ where: { id: sub.id } });
          return;
        }
        await prisma.pushSubscription.update({
          where: { id: sub.id },
          data: { failedCount: next },
        });
      }
    }),
  );

  return attempts;
}
