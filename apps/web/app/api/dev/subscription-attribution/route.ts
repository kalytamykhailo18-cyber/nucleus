import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';

/**
 * E2E-only lookup for a Subscription's attribution fields
 * (Juan 2026-07-30 sales-rep attribution). Gated on E2E_HOOKS_SECRET;
 * 404 everywhere else. Used by the admin-sales-reps spec to assert the
 * URL-param → Subscription attribution wiring.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const secret = env.E2E_HOOKS_SECRET;
  if (!secret) return new NextResponse('not found', { status: 404 });
  const provided = request.headers.get('x-e2e-hook-secret');
  if (provided !== secret) return new NextResponse('not found', { status: 404 });

  const { searchParams } = new URL(request.url);
  const subscriptionId = searchParams.get('subscriptionId');
  if (!subscriptionId) {
    return NextResponse.json(
      { error: 'subscriptionId required' },
      { status: 400 },
    );
  }
  const row = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: { attributionRepId: true, attributionSource: true },
  });
  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json(row);
}
