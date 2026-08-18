import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';

/**
 * E2E-only seam for the sales-rep attribution spec (Juan 2026-07-30).
 * Creates a SalesRep row without going through the admin UI. Gated on
 * E2E_HOOKS_SECRET; returns 404 in every other environment.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  slug: z.string().trim().toLowerCase().min(2).max(48),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(255),
  commissionBps: z.number().int().min(0).max(10_000).optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = env.E2E_HOOKS_SECRET;
  if (!secret) return new NextResponse('not found', { status: 404 });
  const provided = request.headers.get('x-e2e-hook-secret');
  if (provided !== secret) return new NextResponse('not found', { status: 404 });

  const raw = await request.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }
  const rep = await prisma.salesRep.upsert({
    where: { slug: parsed.data.slug },
    update: {
      name: parsed.data.name,
      email: parsed.data.email,
      commissionBps: parsed.data.commissionBps ?? 2000,
      active: true,
    },
    create: {
      slug: parsed.data.slug,
      name: parsed.data.name,
      email: parsed.data.email,
      commissionBps: parsed.data.commissionBps ?? 2000,
      active: true,
    },
    select: { id: true, slug: true },
  });
  return NextResponse.json({ ok: true, id: rep.id, slug: rep.slug });
}
