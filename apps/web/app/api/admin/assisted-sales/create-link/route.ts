import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireSalesOrAdmin } from '@/lib/admin';
import { env } from '@/lib/env';
import {
  createAssistedSaleLink,
  type CreateAssistedSaleLinkArgs,
} from '@/lib/assisted-sales';
import type { PlanType } from '@/lib/plans';

/**
 * Admin endpoint behind /admin/assisted-sales. POST with the lead's
 * name, phone, email, and chosen plan. We mint a Stripe Payment Link
 * and return its URL so the sales rep can paste it into WhatsApp.
 *
 * Gated by NUCLEUS_ASSISTED_SALES_ENABLED at runtime — the route 404s
 * when the flag is off so the surface looks invisible to anyone who
 * stumbles on it before the feature is greenlit.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  email: z.string().email().min(3).max(255),
  fullName: z.string().min(1).max(255),
  phone: z.string().min(5).max(40),
  planType: z.enum(['ANGELA_ESENCIAL', 'ANGELA_TOTAL']),
});

export async function POST(request: NextRequest) {
  if (!env.NUCLEUS_ASSISTED_SALES_ENABLED) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  // requireSalesOrAdmin() redirects internally on failure. ADMIN and
  // SALES both pass; CALLCENTER and family roles bounce to their own
  // home pages. Same pattern as the other /api/admin endpoints.
  await requireSalesOrAdmin();

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'validation failed',
        message: parsed.error.issues[0]?.message ?? 'invalid input',
      },
      { status: 422 },
    );
  }

  const args: CreateAssistedSaleLinkArgs = {
    email: parsed.data.email,
    fullName: parsed.data.fullName,
    phone: parsed.data.phone,
    planType: parsed.data.planType as PlanType,
  };
  try {
    const result = await createAssistedSaleLink(args);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[assisted-sales] link creation failed', err);
    return NextResponse.json(
      { error: 'stripe error', message: (err as Error).message },
      { status: 502 },
    );
  }
}
