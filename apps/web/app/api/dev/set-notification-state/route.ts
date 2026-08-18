import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';

/**
 * Test-only seam (Step 8): jump a user's notification permission +
 * missed-pushes counters to a specific state so the escalation-modal
 * spec can arrive at "denied for 7+ days, 3 missed pushes" without
 * having to wait a week or fire real pushes.
 *
 * Gated by E2E_HOOKS_SECRET — 404 in production.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  userId: z.string().min(1),
  permission: z.enum(['default', 'granted', 'denied']).optional(),
  permissionUpdatedAtOffsetMs: z.number().int().optional(),
  missedPushesCount: z.number().int().min(0).optional(),
  lastMissedPushAtOffsetMs: z.number().int().optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = env.E2E_HOOKS_SECRET;
  if (!secret) return new NextResponse('not found', { status: 404 });
  const provided = request.headers.get('x-e2e-hook-secret');
  if (provided !== secret) return new NextResponse('not found', { status: 404 });

  const raw = await request.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid' }, { status: 422 });
  }
  const {
    userId,
    permission,
    permissionUpdatedAtOffsetMs,
    missedPushesCount,
    lastMissedPushAtOffsetMs,
  } = parsed.data;

  const data: Record<string, unknown> = {};
  if (permission !== undefined) data.notificationPermission = permission;
  if (permissionUpdatedAtOffsetMs !== undefined) {
    data.notificationPermissionUpdatedAt = new Date(
      Date.now() + permissionUpdatedAtOffsetMs,
    );
  }
  if (missedPushesCount !== undefined) data.missedPushesCount = missedPushesCount;
  if (lastMissedPushAtOffsetMs !== undefined) {
    data.lastMissedPushAt = new Date(Date.now() + lastMissedPushAtOffsetMs);
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      notificationPermission: true,
      notificationPermissionUpdatedAt: true,
      missedPushesCount: true,
      lastMissedPushAt: true,
    },
  });
  return NextResponse.json({ ok: true, user: updated });
}
