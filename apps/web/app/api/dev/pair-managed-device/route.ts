import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';

/**
 * Test-only seam (Phase C #1 reshape, 2026-06-10).
 *
 * Pairs a Device to a User as MASTER without going through the
 * /admin/dispatch flow (which requires a paid Subscription that
 * managed workers never have). Lets the managed-fleet spec wire a
 * device to a freshly imported MANAGED_WORKER worker so it can hit
 * the call-center lookup endpoint and assert on the substituted
 * emergencyContacts roster.
 *
 * Idempotent: re-calling with the same (userId, deviceId) pair just
 * returns the existing UserDevice row.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  userId: z.string().min(1),
  deviceId: z.string().min(1).max(64),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = env.E2E_HOOKS_SECRET;
  if (!secret) return new NextResponse('not found', { status: 404 });
  const provided = request.headers.get('x-e2e-hook-secret');
  if (provided !== secret) {
    return new NextResponse('not found', { status: 404 });
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

  const user = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  await prisma.device.upsert({
    where: { deviceId: parsed.data.deviceId },
    create: {
      deviceId: parsed.data.deviceId,
      isActive: true,
    },
    update: {},
  });

  const link = await prisma.userDevice.upsert({
    where: {
      userId_eviewDeviceId: {
        userId: user.id,
        eviewDeviceId: parsed.data.deviceId,
      },
    },
    create: {
      userId: user.id,
      eviewDeviceId: parsed.data.deviceId,
      role: 'MASTER',
      isPrimary: true,
    },
    update: { role: 'MASTER', isPrimary: true },
    select: { id: true, eviewDeviceId: true, role: true },
  });

  return NextResponse.json({ ok: true, userDeviceId: link.id });
}
