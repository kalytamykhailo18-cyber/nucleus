import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

/**
 * Persist a browser PushSubscription for the signed-in user.
 *
 * Same browser re-subscribing returns the existing endpoint via the
 * unique constraint — we upsert by endpoint and reattach to the current
 * user. (A user switching accounts on the same browser hands their
 * push subscription to the new user; that's the desired UX — pushes
 * should follow the active session.)
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(256),
  }),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', message: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 422 },
    );
  }

  const { endpoint, keys } = parsed.data;
  const userAgent = request.headers.get('user-agent')?.slice(0, 256) ?? null;

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: {
      userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent,
    },
    update: {
      userId,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent,
      failedCount: 0,
    },
  });

  return NextResponse.json({ ok: true });
}
