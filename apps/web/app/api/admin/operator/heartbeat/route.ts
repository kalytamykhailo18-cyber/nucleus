import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/admin';

/**
 * Operator heartbeat (Phase B polish, 2026-06-10).
 *
 * Called by /admin/operator every 30 s while the tab is open. Bumps
 * `User.lastOperatorPingAt` for the session user. The presence panel
 * reads this column with a `> now() - 60 s` window to render "En turno
 * ahora" — the 30 s gap means a single dropped beat does not flicker
 * the operator off the panel.
 *
 * `requireAdmin()` guards the route: non-authed → /login, authed but
 * not ADMIN → /dashboard.
 */
export const dynamic = 'force-dynamic';

export async function POST(): Promise<NextResponse> {
  const me = await requireAdmin();
  await prisma.user.update({
    where: { id: me.id },
    data: { lastOperatorPingAt: new Date() },
  });
  return new NextResponse(null, { status: 204 });
}
