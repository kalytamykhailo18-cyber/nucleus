import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';

/**
 * Test-only seam (Phase C #1 reshape, 2026-06-10).
 *
 * Adds an existing User as a CompanyMembership.role=ADMIN of a Company
 * so the managed-fleet spec can drive the /company shared-contacts
 * panel UI as the HR lead would experience it. Idempotent — upserts
 * by (companyId, userId).
 *
 * Gated by E2E_HOOKS_SECRET like every other /api/dev/* endpoint.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  companyId: z.string().min(1),
  userEmail: z.string().email(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = env.E2E_HOOKS_SECRET;
  if (!secret) return new NextResponse('not found', { status: 404 });
  const provided = request.headers.get('x-e2e-hook-secret');
  if (provided !== secret) {
    return new NextResponse('not found', { status: 404 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed' }, { status: 422 });
  }

  const user = await prisma.user.findFirst({
    where: { email: parsed.data.userEmail.toLowerCase() },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
  const company = await prisma.company.findUnique({
    where: { id: parsed.data.companyId },
    select: { id: true },
  });
  if (!company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 });
  }

  await prisma.companyMembership.upsert({
    where: {
      companyId_userId: {
        companyId: parsed.data.companyId,
        userId: user.id,
      },
    },
    create: {
      companyId: parsed.data.companyId,
      userId: user.id,
      role: 'ADMIN',
    },
    update: { role: 'ADMIN' },
  });

  return NextResponse.json({ ok: true, userId: user.id, companyId: parsed.data.companyId });
}
