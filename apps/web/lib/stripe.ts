import Stripe from 'stripe';
import { env } from '@/lib/env';

/**
 * Server-side Stripe SDK singleton.
 *
 * The key flips between test (`sk_test_*`) and live (`sk_live_*`) by env
 * alone. Phase A uses test mode so Playwright's `4242 4242 4242 4242`
 * succeeds; production cutover swaps the env to `sk_live_*`.
 */
let _stripe: Stripe | null = null;

export function stripe(): Stripe {
  if (_stripe) return _stripe;
  _stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    // Pin the API version so an unrelated Stripe-side update doesn't
    // change the shape of the responses we parse. Bump deliberately.
    apiVersion: '2024-11-20.acacia',
    typescript: true,
  });
  return _stripe;
}

export function stripeMode(): 'test' | 'live' {
  return env.STRIPE_SECRET_KEY.startsWith('sk_test_') ? 'test' : 'live';
}
