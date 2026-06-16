/**
 * Phase A+ #2 — signup source resolution.
 *
 * Marketing attribution: every Nucleus signup is tagged with one of:
 *   - an external campaign value (e.g. `fb-ad-q3`, `whatsapp-mayo`)
 *   - a partner channel via promo redemption (e.g. `pemex`)
 *   - an audience-page slug (e.g. `ninos`, `adultos-mayores`)
 *   - null (organic)
 *
 * Capture path: the `nucleus_signup_source` cookie is set sticky-first
 * by middleware whenever a request arrives with `?source=<x>` AND the
 * cookie is unset. Sticky-first means the earliest known marketing
 * source survives subsequent navigation through audience pages
 * (otherwise the audience-page CTA's `?source=ninos` would clobber
 * an `fb-ad-q3` ad-click attribution).
 *
 * Resolution at signup (this helper): cookie → query → promo.channel
 * → null. The cookie comes first because it represents the first
 * marketing surface the buyer touched; the query is a fallback for
 * buyers who arrived without a cookie (e.g. first-time visit clicking
 * straight into the audience CTA).
 */

import { prisma } from '@/lib/db';

export const SIGNUP_SOURCE_COOKIE = 'nucleus_signup_source';
export const SIGNUP_SOURCE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
export const SIGNUP_SOURCE_PATTERN = /^[a-z0-9-]{1,40}$/;

/** Trim + lowercase + whitelist-check. Returns null if invalid. */
export function sanitizeSource(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  return SIGNUP_SOURCE_PATTERN.test(trimmed) ? trimmed : null;
}

export interface ResolveSignupSourceInput {
  cookieValue?: string | null;
  querySource?: string | null;
  promoCode?: string | null;
}

/**
 * Returns the signupSource string to persist on a fresh User row.
 * Precedence: cookie > query > promo.channel > null.
 */
export async function resolveSignupSource(
  input: ResolveSignupSourceInput,
): Promise<string | null> {
  const cookie = sanitizeSource(input.cookieValue);
  if (cookie) return cookie;

  const query = sanitizeSource(input.querySource);
  if (query) return query;

  if (input.promoCode) {
    const promo = await prisma.promoCode.findUnique({
      where: { code: input.promoCode },
      select: { channel: true },
    });
    return sanitizeSource(promo?.channel ?? null);
  }

  return null;
}
