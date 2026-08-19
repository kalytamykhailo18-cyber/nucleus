/**
 * Web-app-side dispatcher.
 *
 * Mirrors `apps/worker/src/push.ts` so dev-seam calls (POST seed-alert
 * with `dispatchPush: true`) and Step 13 admin "send test alert" can
 * fire pushes from the web process without round-tripping MQTT.
 *
 * Step 5 (Juan 2026-08-07): fans out to BOTH audiences on every alert.
 *   - Family: every user paired to the pendant via UserDevice.
 *   - Call center: every CALLCENTER-role user whose onShift is true.
 *     If the alert is critical-tier (sos, fall_detection) every
 *     operator receives it regardless of shift — safety-first.
 *     Fallback: standard-tier + zero on-shift → widen to all operators
 *     so a routine alert can never go to nobody.
 *
 * Shared behaviour:
 *  - VAPID keys missing → no-op + capture to outbox if E2E hooks are on.
 *  - 404 / 410 from the push service → prune the subscription.
 *  - Other failures → bump `failedCount`, prune at threshold.
 *  - Endpoints containing `nucleus-test` skip the real push call (used
 *    by Playwright's seeded synthetic subscriptions).
 */

import webPush from 'web-push';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import {
  buildAlertPayload,
  buildSilentAckPayload,
  type AlertAudience,
  type AlertType,
  type RichAlertPayload,
  type SilentAckPayload,
} from '@/lib/push/build-payload';

export interface AlertPushPayload {
  type: string;
  deviceId: string;
  eventId: string;
  timestamp: string;
}

const FAIL_PRUNE_AFTER = 5;
const TEST_ENDPOINT_MARKER = 'nucleus-test';
const CRITICAL_TYPES = new Set<string>(['sos', 'fall_detection']);

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

interface Subscription {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  failedCount: number;
}

async function sendOne(
  sub: Subscription,
  payload: RichAlertPayload | SilentAckPayload,
  haveVapid: boolean,
  captureOutbox: boolean,
): Promise<void> {
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
    // Urgency knob (RFC 8030): FCM / APNs defer `normal` Web Push during
    // device Doze / App Standby by 1 to 5 minutes, which is exactly the
    // 3 minute delay Juan observed on the first live SOS test. Critical
    // tiers (sos, fall_detection) and silent-acks (which close active
    // alarms on peer phones) MUST arrive within seconds, so mark them
    // `high` — same posture as the native Expo path already uses. Raise
    // TTL on the same branch from 60 s to 300 s so a browser that wakes
    // within the window still receives the notification instead of the
    // push service dropping it. Non-critical tiers keep the tighter TTL
    // and default urgency to preserve device battery.
    const isCritical =
      CRITICAL_TYPES.has(payload.type) || payload.type === 'silent_ack';
    await webPush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify(payload),
      isCritical
        ? { TTL: 300, urgency: 'high' }
        : { TTL: 60, urgency: 'normal' },
    );
    await prisma.pushSubscription.update({
      where: { id: sub.id },
      data: { lastSentAt: new Date(), failedCount: 0 },
    });
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) {
      await prisma.pushSubscription.deleteMany({ where: { id: sub.id } });
      // A 410 means the browser has quietly revoked the subscription
      // (uninstalled, permission flipped to denied at OS level, etc.).
      // Count it as a missed push against the user so Step 8's
      // escalation modal knows the alert never landed.
      await bumpMissed(sub.userId);
      return;
    }
    const next = sub.failedCount + 1;
    if (next >= FAIL_PRUNE_AFTER) {
      await prisma.pushSubscription.deleteMany({ where: { id: sub.id } });
      await bumpMissed(sub.userId);
      return;
    }
    await prisma.pushSubscription.update({
      where: { id: sub.id },
      data: { failedCount: next },
    });
  }
}

async function bumpMissed(userId: string): Promise<void> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        missedPushesCount: { increment: 1 },
        lastMissedPushAt: new Date(),
      },
    });
  } catch {
    // Never let a counter update blow up the dispatch — the alert
    // path is more important than analytics fidelity.
  }
}

/**
 * Escalation counter for users whose last known Notification.permission
 * is `denied`. Called before we even try to send: if the client last
 * reported denied, the push is guaranteed to be silent on that device,
 * so we count it as missed up front instead of waiting on a 410.
 */
async function bumpMissedForDeniedUsers(userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  try {
    await prisma.user.updateMany({
      where: {
        id: { in: userIds },
        notificationPermission: 'denied',
      },
      data: {
        missedPushesCount: { increment: 1 },
        lastMissedPushAt: new Date(),
      },
    });
  } catch {
    // See bumpMissed — never block the send path on a counter update.
  }
}

async function loadSubscriptions(userIds: string[]): Promise<Subscription[]> {
  if (userIds.length === 0) return [];
  return prisma.pushSubscription.findMany({
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
}

export async function dispatchAlertPush(
  deviceId: string,
  payload: AlertPushPayload,
): Promise<number> {
  const isCritical = CRITICAL_TYPES.has(payload.type);

  // Family audience — every user paired to this pendant.
  const familyUserDevices = await prisma.userDevice.findMany({
    where: { eviewDeviceId: deviceId },
    select: { userId: true },
  });
  const familyUserIds = [
    ...new Set(familyUserDevices.map((ud) => ud.userId)),
  ];

  // Senior-name lookup for the RICH title. Cross-cuts both audiences —
  // family sees "María Elena presionó SOS", operator sees
  // "SOS · María Elena · <device>" (built by buildAlertPayload).
  const masterRow = await prisma.userDevice.findFirst({
    where: { eviewDeviceId: deviceId, role: 'MASTER' },
    select: { label: true, user: { select: { fullName: true } } },
    orderBy: { assignedAt: 'asc' },
  });
  const seniorName =
    masterRow?.label?.trim() || masterRow?.user?.fullName?.trim() || null;

  // Operator audience — CALLCENTER users filtered by shift (unless
  // critical-tier, which always fans to all). Fallback: standard-tier
  // + zero on-shift → widen to all operators so alerts never go dark.
  let operatorUsers = await prisma.user.findMany({
    where: {
      role: 'CALLCENTER',
      isActive: true,
      ...(isCritical ? {} : { onShift: true }),
    },
    select: { id: true },
  });
  if (!isCritical && operatorUsers.length === 0) {
    operatorUsers = await prisma.user.findMany({
      where: { role: 'CALLCENTER', isActive: true },
      select: { id: true },
    });
  }
  const operatorUserIds = operatorUsers.map((u) => u.id);

  const [familySubs, operatorSubs] = await Promise.all([
    loadSubscriptions(familyUserIds),
    loadSubscriptions(operatorUserIds),
  ]);

  // Escalation counter: bump before any actual send so users who
  // blocked notifications still get counted against the "at least
  // one push was missed this week" gate. Fire-and-forget on both
  // audiences in parallel with the send.
  await bumpMissedForDeniedUsers([...familyUserIds, ...operatorUserIds]);

  if (familySubs.length === 0 && operatorSubs.length === 0) return 0;

  const familyPayload = buildAlertPayload({
    type: payload.type as AlertType,
    alertId: payload.eventId,
    deviceId: payload.deviceId,
    audience: 'family',
    seniorName,
  });
  const operatorPayload = buildAlertPayload({
    type: payload.type as AlertType,
    alertId: payload.eventId,
    deviceId: payload.deviceId,
    audience: 'operator' satisfies AlertAudience,
    seniorName,
  });

  const haveVapid = ensureVapid();
  const captureOutbox = !!env.E2E_HOOKS_SECRET;

  await Promise.all([
    ...familySubs.map((sub) =>
      sendOne(sub, familyPayload, haveVapid, captureOutbox),
    ),
    ...operatorSubs.map((sub) =>
      sendOne(sub, operatorPayload, haveVapid, captureOutbox),
    ),
  ]);

  return familySubs.length + operatorSubs.length;
}

/**
 * Silent-ack fanout (Step 6).
 *
 * Fires a `type: 'silent_ack'` push to every subscription in the ack
 * audience. The SW recognizes the marker, skips `showNotification`,
 * and closes any active notification whose tag matches the alertId
 * — so the moment one family member taps "Ya vi", every other family
 * phone stops buzzing. The acknowledger's own phones are included
 * on purpose: their notification with that tag has already closed
 * (via the ack tap or the in-app UI) so the fan-out is a harmless
 * no-op there, and this keeps the server oblivious to which specific
 * subscription drove the ack.
 *
 * Audience rules per the implementation plan:
 *   - family ack   → every family user paired to the device
 *   - operator ack → every CALLCENTER user (family banners stay up;
 *     operator ack does not resolve for family)
 *
 * Returns the number of subscriptions targeted.
 */
export async function dispatchSilentAck(input: {
  alertId: string;
  deviceId: string;
  ackSource: 'family' | 'operator';
}): Promise<number> {
  const { alertId, deviceId, ackSource } = input;

  let targetUserIds: string[] = [];
  if (ackSource === 'family') {
    const familyUserDevices = await prisma.userDevice.findMany({
      where: { eviewDeviceId: deviceId },
      select: { userId: true },
    });
    targetUserIds = [...new Set(familyUserDevices.map((ud) => ud.userId))];
  } else {
    const operatorUsers = await prisma.user.findMany({
      where: { role: 'CALLCENTER', isActive: true },
      select: { id: true },
    });
    targetUserIds = operatorUsers.map((u) => u.id);
  }

  const subs = await loadSubscriptions(targetUserIds);
  if (subs.length === 0) return 0;

  const payload = buildSilentAckPayload(alertId, ackSource);
  const haveVapid = ensureVapid();
  const captureOutbox = !!env.E2E_HOOKS_SECRET;

  await Promise.all(
    subs.map((sub) => sendOne(sub, payload, haveVapid, captureOutbox)),
  );
  return subs.length;
}
