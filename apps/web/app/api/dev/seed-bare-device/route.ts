import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';

/**
 * Test seam — upsert a Device row with no UserDevice link. Mimics the
 * "Sensu admin pre-assigns an IMEI to a customer order" step from
 * Juan's flat-claim model: the device exists in our DB before any
 * family member arrives at /signup/claim, but it has no claimants yet.
 *
 * Gated by E2E_HOOKS_SECRET — same auth model as the other dev seams.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  deviceId: z.string().min(1).max(64),
  isActive: z.boolean().optional().default(true),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
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
      { error: 'invalid', message: parsed.error.issues[0]?.message ?? 'invalid' },
      { status: 422 },
    );
  }

  await prisma.device.upsert({
    where: { deviceId: parsed.data.deviceId },
    create: {
      deviceId: parsed.data.deviceId,
      deviceType: 'PENDANT',
      isActive: parsed.data.isActive,
    },
    update: {
      isActive: parsed.data.isActive,
    },
  });

  return NextResponse.json({ ok: true });
}
