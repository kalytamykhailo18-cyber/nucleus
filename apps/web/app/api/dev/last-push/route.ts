import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';

/**
 * Test-only seam: return the most recent push attempt the worker tried
 * to dispatch, optionally filtered by userId. Mirrors `/api/dev/last-email`
 * for email outbox. Lets Playwright assert "the SOS triggered a push to
 * the right user with the right payload" without spinning up a real
 * push service.
 *
 * Gated by E2E_HOOKS_SECRET — disabled in production.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const secret = env.E2E_HOOKS_SECRET;
  if (!secret) return new NextResponse('not found', { status: 404 });
  const provided = request.headers.get('x-e2e-hook-secret');
  if (provided !== secret) return new NextResponse('not found', { status: 404 });

  const userId = request.nextUrl.searchParams.get('userId') ?? undefined;
  const sinceRaw = request.nextUrl.searchParams.get('since');
  const since = sinceRaw ? new Date(sinceRaw) : undefined;

  const row = await prisma.pushOutboxTest.findFirst({
    where: {
      ...(userId ? { userId } : {}),
      ...(since && !Number.isNaN(since.getTime()) ? { createdAt: { gte: since } } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!row) {
    return NextResponse.json({ push: null });
  }

  return NextResponse.json({
    push: {
      id: row.id,
      userId: row.userId,
      endpoint: row.endpoint,
      payload: row.payloadJson,
      createdAt: row.createdAt.toISOString(),
    },
  });
}

export async function DELETE(request: NextRequest) {
  const secret = env.E2E_HOOKS_SECRET;
  if (!secret) return new NextResponse('not found', { status: 404 });
  const provided = request.headers.get('x-e2e-hook-secret');
  if (provided !== secret) return new NextResponse('not found', { status: 404 });

  const userId = request.nextUrl.searchParams.get('userId');
  if (userId) {
    const result = await prisma.pushOutboxTest.deleteMany({ where: { userId } });
    return NextResponse.json({ ok: true, deleted: result.count });
  }

  const result = await prisma.pushOutboxTest.deleteMany({});
  return NextResponse.json({ ok: true, deleted: result.count });
}
