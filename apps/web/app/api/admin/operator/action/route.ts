import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

/**
 * Operator dispatch log — append-only.
 *
 * POST records a new action against an EviewEvent. GET lists every
 * action recorded against a given event, oldest first, so the next
 * dispatcher who opens the caller-ID modal sees the timeline. Admin-
 * only on both verbs; inline auth check to keep the JSON 401/403
 * contract (no /dashboard redirect for API callers).
 */

export const dynamic = 'force-dynamic';

const ACTION_KINDS = [
  'CALLED_SENIOR',
  'CALLED_EMERGENCY_CONTACT',
  'CALLED_FAMILY',
  'PHONED_AURA',
  'NOTED',
  'RESOLVED',
] as const;

const postSchema = z.object({
  eviewEventId: z.string().min(1),
  kind: z.enum(ACTION_KINDS),
  note: z.string().max(2_000).optional().nullable(),
});

async function requireAdminUserId(): Promise<
  { ok: true; userId: string } | { ok: false; status: 401 | 403 }
> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return { ok: false, status: 401 };
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!user || user.role !== 'ADMIN') return { ok: false, status: 403 };
  return { ok: true, userId };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const gate = await requireAdminUserId();
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.status === 401 ? 'Unauthorized' : 'Forbidden' },
      { status: gate.status },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_body', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const eventExists = await prisma.eviewEvent.findUnique({
    where: { id: parsed.data.eviewEventId },
    select: { id: true },
  });
  if (!eventExists) {
    return NextResponse.json({ error: 'event_not_found' }, { status: 404 });
  }

  const action = await prisma.operatorAction.create({
    data: {
      eviewEventId: parsed.data.eviewEventId,
      operatorUserId: gate.userId,
      kind: parsed.data.kind,
      note: parsed.data.note ?? null,
    },
    select: {
      id: true,
      kind: true,
      note: true,
      createdAt: true,
      operator: { select: { fullName: true, email: true } },
    },
  });

  return NextResponse.json({ action });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const gate = await requireAdminUserId();
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.status === 401 ? 'Unauthorized' : 'Forbidden' },
      { status: gate.status },
    );
  }

  const eviewEventId = request.nextUrl.searchParams.get('eviewEventId');
  if (!eviewEventId) {
    return NextResponse.json({ error: 'eviewEventId required' }, { status: 400 });
  }

  const actions = await prisma.operatorAction.findMany({
    where: { eviewEventId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      kind: true,
      note: true,
      createdAt: true,
      operator: { select: { fullName: true, email: true } },
    },
  });

  return NextResponse.json({ actions });
}
