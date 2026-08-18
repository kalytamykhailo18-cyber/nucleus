import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

/**
 * Escalation feed (Step 8).
 *
 * Returns the current user's missed-push counter, current permission,
 * and a boolean `escalate` flag that captures the two conditions the
 * escalation modal watches for:
 *
 *   - permission is `denied`
 *   - AND the current permission state has been held for 7+ days
 *   - AND at least one push landed on this user during that window
 *
 * The client can trust `escalate` directly — server owns the
 * threshold so it can be tuned without shipping new frontend code.
 */
export const dynamic = 'force-dynamic';

const ESCALATE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET(): Promise<NextResponse> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      notificationPermission: true,
      notificationPermissionUpdatedAt: true,
      missedPushesCount: true,
      lastMissedPushAt: true,
    },
  });
  if (!user) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const deniedSince = user.notificationPermissionUpdatedAt
    ? Date.now() - user.notificationPermissionUpdatedAt.getTime()
    : 0;
  const escalate =
    user.notificationPermission === 'denied' &&
    deniedSince >= ESCALATE_WINDOW_MS &&
    user.missedPushesCount >= 1;

  return NextResponse.json({
    permission: user.notificationPermission,
    permissionUpdatedAt:
      user.notificationPermissionUpdatedAt?.toISOString() ?? null,
    missedPushesCount: user.missedPushesCount,
    lastMissedPushAt: user.lastMissedPushAt?.toISOString() ?? null,
    escalate,
  });
}
