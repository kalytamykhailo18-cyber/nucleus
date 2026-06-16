import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { env } from '@/lib/env';
import { sendPaymentConfirmationEmail } from '@/lib/emails/payment-confirmation';

/**
 * Test-only seam: fires the payment-confirmation email for a given
 * Subscription id. Lets the Step 8 spec assert the cadence-aware
 * breakdown without driving a real Stripe PaymentIntent through the
 * checkout flow. Gated by E2E_HOOKS_SECRET; production deployments
 * leave the env unset and every request 404s.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  subscriptionId: z.string().min(1).max(64),
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
    return NextResponse.json({ error: 'Validation failed' }, { status: 422 });
  }

  await sendPaymentConfirmationEmail(parsed.data.subscriptionId);
  return NextResponse.json({ ok: true });
}
