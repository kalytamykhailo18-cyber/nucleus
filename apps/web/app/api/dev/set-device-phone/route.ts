import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';

/**
 * Test-only seam: stamps a phoneNumber on a Device row. Used by the
 * caller-ID modal spec to provision a known device-side phone before
 * asserting the dispatcher's tel: link renders. Also handy for
 * backfilling pre-existing devices during a Juan-side review.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  eviewDeviceId: z.string().min(1).max(64),
  phoneNumber: z.string().min(3).max(32).nullable(),
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
      { error: 'Validation failed', message: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 422 },
    );
  }
  const { eviewDeviceId, phoneNumber } = parsed.data;

  // Upsert so the seam works even on a device that hasn't received MQTT.
  await prisma.device.upsert({
    where: { deviceId: eviewDeviceId },
    create: { deviceId: eviewDeviceId, deviceType: 'PENDANT', phoneNumber },
    update: { phoneNumber },
  });

  return NextResponse.json({ ok: true, eviewDeviceId, phoneNumber });
}
