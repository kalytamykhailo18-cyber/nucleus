import { NextResponse } from 'next/server';
import { requireCallcenterOrAdmin } from '@/lib/admin';
import { fetchOperatorBoard } from '@/lib/operator-board';

/**
 * Polling endpoint for /admin/operator (Juan 2026-06-25). Returns the
 * current page-1 slice of the priority alert queue in a slim JSON
 * shape so the client can:
 *
 *   1. detect when a new SOS or fall_detection row arrives between
 *      poll cycles, and
 *   2. play an audible cue for the operator on shift, so a fresh
 *      emergency cannot sit silently waiting for a manual refresh.
 *
 * Deliberately page-1-only: the cue is about new arrivals, and
 * `fetchOperatorBoard` orders by timestamp DESC so anything fresh
 * lands here. Older pages are still reachable via the normal page
 * load. Returning the slim payload (not full alerts) keeps the poll
 * cheap on a board that can carry hundreds of rows.
 */
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

export async function GET(): Promise<NextResponse> {
  const admin = await requireCallcenterOrAdmin();
  const board = await fetchOperatorBoard(1, PAGE_SIZE, {
    callcenterMode: admin.callcenterMode,
  });
  return NextResponse.json({
    ok: true,
    alerts: board.alerts.map((a) => ({
      id: a.id,
      eventType: a.eventType,
      timestamp: a.timestamp,
      isResolved: a.isResolved,
    })),
  });
}
