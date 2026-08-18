import { NextResponse } from 'next/server';
import { fetchActivePlans } from '@/lib/plans';

/**
 * Public pricing feed for the marketing site (Juan 2026-06-29 strategic
 * decision: marketing site spinoff). The future marketing site sits at
 * sensu.com.mx and needs to render the same prices Nucleus charges at
 * checkout — without manually copying numbers into the marketing copy
 * every time pricing shifts.
 *
 * Returns the live active-plan rows shaped for public display:
 *   - canonical slug (PlanType lowercased) the marketing site can
 *     use to route into Nucleus checkout (`/checkout?plan=ANGELA_ESENCIAL`)
 *   - display name + description
 *   - includesAura flag (the only real product-tier delta)
 *   - initial fee + per-cadence recurring prices in net centavos
 *
 * Deliberately stripped: every Stripe price/product id, every internal
 * popular flag, every legacy field. Those belong to the checkout layer
 * only and have no business leaking to a third-party-managed marketing
 * surface.
 *
 * Cache-control: 60 s browser cache + 300 s CDN cache. Pricing changes
 * are rare (Juan touches them at most every few months); CDN nodes
 * picking up a 5-minute-stale price beats hammering the DB on every
 * marketing-page render.
 *
 * CORS: open to any origin via `*` since this is genuinely public
 * data. Marketing site will be on a different subdomain (sensu.com.mx
 * vs app.sensu.com.mx) so browsers treat it as cross-origin.
 */
export const dynamic = 'force-dynamic';
export const revalidate = 60;

interface PublicPlan {
  slug: 'ANGELA_ESENCIAL' | 'ANGELA_TOTAL';
  name: string;
  description: string;
  currency: 'MXN';
  includesAura: boolean;
  initialFeeCents: number | null;
  priceMonthlyCents: number | null;
  priceSemestralCents: number | null;
  priceAnnualCents: number | null;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
} as const;

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(): Promise<NextResponse> {
  const rows = await fetchActivePlans();

  const plans: PublicPlan[] = rows.map((p) => ({
    slug: p.type,
    name: p.name,
    description: p.description,
    currency: 'MXN',
    includesAura: p.includesAura,
    initialFeeCents: p.initialFeeCents,
    priceMonthlyCents: p.priceMonthlyCents,
    priceSemestralCents: p.priceSemestralCents,
    priceAnnualCents: p.priceAnnualCents,
  }));

  return NextResponse.json(
    { plans, generatedAt: new Date().toISOString() },
    {
      headers: {
        ...CORS_HEADERS,
        'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
      },
    },
  );
}
