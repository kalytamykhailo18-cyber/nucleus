import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';

/**
 * Test seam + production hook: write a parity observation tagged
 * source='PYTHON'. In Phase A, the Step 14 spec calls this directly to
 * simulate the Python subscriber's contribution. In production, the
 * sensu-api Python subscriber calls this endpoint after every event
 * save so the comparator has both halves of the pair.
 *
 * Gated by E2E_HOOKS_SECRET — same auth model as the other dev seams.
 * For production cutover, sensu-api authenticates with the same secret
 * (or we move it to a long-lived API key in Phase B).
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  /** Defaults to PYTHON for back-compat with the original sensu-api
   * hook; pass 'TS' to seed a TypeScript-side observation manually for
   * fixture purposes (the worker writes TS rows organically — this
   * override is only needed in seed scripts). */
  source: z.enum(['TS', 'PYTHON']).default('PYTHON'),
  eviewDeviceId: z.string().min(1).max(64),
  eventType: z.string().min(1).max(48),
  timestampIso: z.string().datetime(),
  statusCode: z.number().int().nullable().optional(),
  alarmCode: z.number().int().nullable().optional(),
  batteryLevel: z.number().int().min(0).max(100).nullable().optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  eviewEventId: z.string().nullable().optional(),
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

  const created = await prisma.workerParityCheck.create({
    data: {
      source: parsed.data.source,
      eviewDeviceId: parsed.data.eviewDeviceId,
      eventType: parsed.data.eventType,
      timestamp: new Date(parsed.data.timestampIso),
      statusCode: parsed.data.statusCode ?? null,
      alarmCode: parsed.data.alarmCode ?? null,
      batteryLevel: parsed.data.batteryLevel ?? null,
      lat: parsed.data.lat ?? null,
      lng: parsed.data.lng ?? null,
      eviewEventId: parsed.data.eviewEventId ?? null,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: created.id });
}
