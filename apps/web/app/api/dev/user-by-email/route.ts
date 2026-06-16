import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';

/**
 * Test-only seam (Phase C #1 reshape, 2026-06-10).
 *
 * Returns a User's id by email. Lets specs resolve the synthesized
 * `worker-<cuid>@managed.sensu.internal` rows minted by the managed-
 * fleet CSV import without having to introspect the DB.
 *
 * Gated by E2E_HOOKS_SECRET like every other /api/dev/* endpoint.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const secret = env.E2E_HOOKS_SECRET;
  if (!secret) return new NextResponse('not found', { status: 404 });
  const provided = request.headers.get('x-e2e-hook-secret');
  if (provided !== secret) {
    return new NextResponse('not found', { status: 404 });
  }
  const email = request.nextUrl.searchParams.get('email');
  if (!email) {
    return NextResponse.json({ error: 'missing ?email=' }, { status: 400 });
  }
  const user = await prisma.user.findFirst({
    where: { email: email.toLowerCase() },
    select: { id: true, email: true, kind: true },
  });
  if (!user) {
    return NextResponse.json({ found: false }, { status: 404 });
  }
  return NextResponse.json({
    found: true,
    userId: user.id,
    email: user.email,
    kind: user.kind,
  });
}
