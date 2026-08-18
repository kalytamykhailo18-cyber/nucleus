import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

/**
 * Client permission sync (Step 8).
 *
 * The NotificationPermissionGuard reads `Notification.permission` on
 * every mount and posts the value here so the server has a fresh
 * per-user snapshot to decide when to escalate. Idempotent — writes
 * the timestamp only when the value flips, so the "7 days denied"
 * clock is anchored to the moment the user last blocked us, not to
 * the last time they opened the page.
 *
 * Accepts values default | granted | denied only; anything else 422.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  permission: z.enum(['default', 'granted', 'denied']),
});

export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const raw = await request.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid' }, { status: 422 });
  }

  const current = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      notificationPermission: true,
      notificationPermissionUpdatedAt: true,
    },
  });
  if (!current) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const flipped = current.notificationPermission !== parsed.data.permission;
  await prisma.user.update({
    where: { id: userId },
    data: {
      notificationPermission: parsed.data.permission,
      ...(flipped
        ? { notificationPermissionUpdatedAt: new Date() }
        : current.notificationPermissionUpdatedAt
          ? {}
          : { notificationPermissionUpdatedAt: new Date() }),
      // Any flip back to a non-denied state clears the missed-push
      // counter — the escalation modal only fires while permission is
      // actively denied.
      ...(flipped && parsed.data.permission !== 'denied'
        ? { missedPushesCount: 0, lastMissedPushAt: null }
        : {}),
    },
  });

  return NextResponse.json({
    ok: true,
    permission: parsed.data.permission,
    flipped,
  });
}
