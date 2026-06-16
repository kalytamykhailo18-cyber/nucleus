import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

/**
 * Drop the PushSubscription row for the given endpoint. Only deletes
 * subscriptions owned by the current user — passing somebody else's
 * endpoint quietly returns ok:true, no enumeration leak.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  endpoint: z.string().url().max(2048),
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
    return NextResponse.json({ error: 'Validation failed' }, { status: 422 });
  }

  await prisma.pushSubscription.deleteMany({
    where: { endpoint: parsed.data.endpoint, userId },
  });

  return NextResponse.json({ ok: true });
}
