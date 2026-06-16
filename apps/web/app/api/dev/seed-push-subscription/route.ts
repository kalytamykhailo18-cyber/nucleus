import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';

/**
 * Test-only seam: plant a synthetic PushSubscription on a user so the
 * worker's dispatcher has somewhere to fan out to. The endpoint contains
 * the `nucleus-test` marker — the dispatcher recognizes it and writes
 * to PushOutboxTest without round-tripping a real push service.
 *
 * Idempotent: re-seeding the same userEmail replaces the prior synthetic
 * subscription so the spec always starts from one known endpoint.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  userEmail: z.string().email(),
  endpointSuffix: z.string().min(1).max(64).optional(),
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

  const { userEmail, endpointSuffix } = parsed.data;
  const userRows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "User" WHERE LOWER(email) = ${userEmail.toLowerCase()} LIMIT 1
  `;
  const user = userRows[0];
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const suffix = endpointSuffix ?? user.id;
  const endpoint = `https://nucleus-test.invalid/push/${suffix}`;
  // Plausible-shaped fake keys — they're never used because the
  // dispatcher recognizes the test endpoint and skips web-push.
  const p256dh = 'BJ-test-key-' + suffix.slice(0, 32).padEnd(32, 'x');
  const authKey = 'auth-test-' + suffix.slice(0, 16);

  // Wipe ALL prior subs for this user so the spec sees exactly one
  // (synthetic) row. The demo user is a test fixture, so any real FCM
  // endpoint accumulated from a live-browser session would otherwise
  // win the "first push subscription" race in the dispatcher and break
  // the spec — the dispatcher would actually call Google FCM instead
  // of recognizing the nucleus-test marker.
  await prisma.pushSubscription.deleteMany({
    where: { userId: user.id },
  });

  await prisma.pushSubscription.create({
    data: {
      userId: user.id,
      endpoint,
      p256dh,
      auth: authKey,
      userAgent: 'nucleus-test/playwright',
    },
  });

  return NextResponse.json({ ok: true, userId: user.id, endpoint });
}
