import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';

/**
 * Test-only seam: stamps the per-cadence pricing fields on an existing
 * Plan row. Used by seed-e2e to back-fill the 2026-05-26 pricing pivot
 * (initial fee + monthly/semestral/annual cadences) onto the seeded
 * Esencial and Total plans without requiring a manual prisma update.
 *
 * Plans must already exist (Plan.type unique); this route only
 * UPDATES, never CREATES — that matches how the rest of the platform
 * treats plans as catalogue rows owned by ops, not test fixtures.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  planType: z.enum(['ANGELA_ESENCIAL', 'ANGELA_TOTAL']),
  initialFeeCents: z.number().int().min(0).nullable().optional(),
  stripePriceIdInitialFee: z.string().max(64).nullable().optional(),
  priceMonthlyCents: z.number().int().min(0).nullable().optional(),
  priceSemestralCents: z.number().int().min(0).nullable().optional(),
  priceAnnualCents: z.number().int().min(0).nullable().optional(),
  stripePriceIdMonthly: z.string().max(64).nullable().optional(),
  stripePriceIdSemestral: z.string().max(64).nullable().optional(),
  stripePriceIdAnnual: z.string().max(64).nullable().optional(),
});

export async function POST(request: NextRequest) {
  const secret = env.E2E_HOOKS_SECRET;
  if (!secret) return new NextResponse('not found', { status: 404 });
  const provided = request.headers.get('x-e2e-hook-secret');
  if (provided !== secret) return new NextResponse('not found', { status: 404 });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        message: parsed.error.issues[0]?.message ?? 'Invalid input',
      },
      { status: 422 },
    );
  }

  const { planType, ...prices } = parsed.data;
  const existing = await prisma.plan.findUnique({ where: { type: planType } });
  if (!existing) {
    return NextResponse.json({ error: 'plan_not_found' }, { status: 404 });
  }

  const updated = await prisma.plan.update({
    where: { type: planType },
    data: prices,
    select: {
      type: true,
      initialFeeCents: true,
      priceMonthlyCents: true,
      priceSemestralCents: true,
      priceAnnualCents: true,
    },
  });

  return NextResponse.json({ ok: true, plan: updated });
}
