import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

/**
 * Bulk-resolve stale unresolved alerts (Juan 2026-06-30).
 *
 * Call-center pain point: the operator queue accumulates handled-but-
 * never-marked-resolved alerts over weeks. A fresh dispatcher arriving
 * for a shift can't tell SOS rows that need attention NOW from rows
 * that were handled hours ago without anyone closing them out.
 *
 * This endpoint closes the latter cohort: every unresolved EviewEvent
 * older than `olderThanHours` (default 24) gets a fresh RESOLVED
 * OperatorAction attributed to the calling operator. The 24-hour gate
 * is a safety: NO fresh SOS gets accidentally swept into bulk-resolve
 * by an over-zealous click. Anything within the gate stays in the
 * queue for the operator to triage one-by-one.
 *
 * Auth: ADMIN or CALLCENTER (same as the per-row action route).
 * Returns: { count, eventIds }.
 */

export const dynamic = 'force-dynamic';

const MIN_GATE_HOURS = 6;
const DEFAULT_GATE_HOURS = 24;
const MAX_BULK_PER_CALL = 500;

const postSchema = z.object({
  olderThanHours: z
    .number()
    .int()
    .min(MIN_GATE_HOURS)
    .max(24 * 365)
    .optional(),
});

async function requireOperatorUserId(): Promise<
  { ok: true; userId: string } | { ok: false; status: 401 | 403 }
> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return { ok: false, status: 401 };
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!user || (user.role !== 'ADMIN' && user.role !== 'CALLCENTER')) {
    return { ok: false, status: 403 };
  }
  return { ok: true, userId };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const gate = await requireOperatorUserId();
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.status === 401 ? 'Unauthorized' : 'Forbidden' },
      { status: gate.status },
    );
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // Empty body is fine — caller can rely on defaults.
  }
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_body', details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const olderThanHours = parsed.data.olderThanHours ?? DEFAULT_GATE_HOURS;
  const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1_000);

  // Find unresolved EviewEvents older than cutoff: events with NO
  // RESOLVED action on their OperatorAction log. We cap the batch at
  // MAX_BULK_PER_CALL so a single click cannot pin the DB; the caller
  // can re-fire until the queue is empty.
  const candidates = await prisma.eviewEvent.findMany({
    where: {
      timestamp: { lt: cutoff },
      // Subquery: no RESOLVED action exists.
      operatorActions: { none: { kind: 'RESOLVED' } },
    },
    orderBy: { timestamp: 'asc' },
    take: MAX_BULK_PER_CALL,
    select: { id: true },
  });
  if (candidates.length === 0) {
    return NextResponse.json({ count: 0, eventIds: [] });
  }

  const createdAt = new Date();
  await prisma.operatorAction.createMany({
    data: candidates.map((e) => ({
      eviewEventId: e.id,
      operatorUserId: gate.userId,
      kind: 'RESOLVED' as const,
      note: `Bulk-resolved (> ${olderThanHours}h old)`,
      createdAt,
    })),
  });

  return NextResponse.json({
    count: candidates.length,
    eventIds: candidates.map((e) => e.id),
    capped: candidates.length === MAX_BULK_PER_CALL,
  });
}
