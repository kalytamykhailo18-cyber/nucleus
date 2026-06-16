import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';

/**
 * Test-only seam: returns the most recent email sent to a given address from
 * the EmailOutboxTest table. Required by the Step 3 Playwright spec to fetch
 * the password-reset URL without depending on real email delivery.
 *
 * Gated by an env-var-controlled secret. If E2E_HOOKS_SECRET is unset, every
 * request is 404. If set, requests must echo the same value in the
 * X-E2E-Hook-Secret header — production deployments simply leave the env
 * unset to disable the endpoint entirely.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const secret = env.E2E_HOOKS_SECRET;
  if (!secret) {
    return new NextResponse('not found', { status: 404 });
  }
  const provided = request.headers.get('x-e2e-hook-secret');
  if (provided !== secret) {
    return new NextResponse('not found', { status: 404 });
  }

  const to = request.nextUrl.searchParams.get('to');
  if (!to) {
    return NextResponse.json({ error: 'missing ?to=' }, { status: 400 });
  }

  const row = await prisma.emailOutboxTest.findFirst({
    where: { to: to.toLowerCase() },
    orderBy: { createdAt: 'desc' },
  });
  if (!row) {
    return NextResponse.json({ found: false });
  }
  return NextResponse.json({
    found: true,
    to: row.to,
    subject: row.subject,
    body: row.body,
    createdAt: row.createdAt,
  });
}
