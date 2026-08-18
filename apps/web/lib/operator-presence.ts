import { prisma } from '@/lib/db';
import { ALERT_EVENT_TYPES } from '@/lib/alerts';

/**
 * Operator presence + load (Phase B polish, 2026-06-10).
 *
 * "En turno ahora" = any ADMIN or CALLCENTER whose `lastOperatorPingAt` has been
 * bumped by the /api/admin/operator/heartbeat endpoint within the last
 * 60 s. Load = how many actionable EviewEvents have this operator as
 * the author of their most recent OperatorAction AND that latest action
 * is not a RESOLVED row.
 *
 * "Latest action per event" is computed with Postgres `DISTINCT ON
 * (eviewEventId) ORDER BY createdAt DESC` — Prisma does not support
 * window functions, and the same idiom already lives in
 * lib/operator-board.ts for the queue dedup. The aggregation then
 * happens in JS so the spec can drop a deterministic seed and assert
 * on the count without a TIMESTAMP migration.
 */

export const PRESENCE_WINDOW_SECONDS = 60;

export interface OperatorPresence {
  operatorId: string;
  email: string;
  fullName: string | null;
  lastPingAt: string;
  load: number;
}

export async function fetchOperatorPresence(): Promise<OperatorPresence[]> {
  const cutoff = new Date(Date.now() - PRESENCE_WINDOW_SECONDS * 1_000);

  const onShift = await prisma.user.findMany({
    where: {
      // Anyone with operator-board access — ADMIN god-role + the
      // narrower CALLCENTER dispatcher role. Both call /api/admin/operator/heartbeat
      // while the tab is open, so both appear on the presence panel.
      role: { in: ['ADMIN', 'CALLCENTER'] },
      lastOperatorPingAt: { gte: cutoff },
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      lastOperatorPingAt: true,
    },
    orderBy: { lastOperatorPingAt: 'desc' },
  });

  if (onShift.length === 0) {
    return [];
  }

  // Latest OperatorAction per actionable EviewEvent. The dispatcher who
  // touched it most recently is the one carrying it on their plate;
  // when that latest row's kind is RESOLVED, the alert is closed and we
  // drop it from the tally.
  type LatestRow = {
    eviewEventId: string;
    operatorUserId: string;
    kind: string;
  };
  const latest = await prisma.$queryRaw<LatestRow[]>`
    SELECT DISTINCT ON (a."eviewEventId")
      a."eviewEventId", a."operatorUserId", a."kind"
    FROM "OperatorAction" a
    INNER JOIN "EviewEvent" e ON e.id = a."eviewEventId"
    WHERE e."eventType" = ANY(${ALERT_EVENT_TYPES as readonly string[]}::text[])
      AND e."eviewDeviceId" NOT LIKE 'STEP6UI-%'
      AND e."eviewDeviceId" NOT LIKE 'E2E-%'
    ORDER BY a."eviewEventId", a."createdAt" DESC
  `;

  const loadByOperator = new Map<string, number>();
  for (const row of latest) {
    if (row.kind === 'RESOLVED') continue;
    loadByOperator.set(
      row.operatorUserId,
      (loadByOperator.get(row.operatorUserId) ?? 0) + 1,
    );
  }

  return onShift.map((u) => ({
    operatorId: u.id,
    email: u.email,
    fullName: u.fullName,
    lastPingAt: (u.lastOperatorPingAt ?? new Date()).toISOString(),
    load: loadByOperator.get(u.id) ?? 0,
  }));
}
