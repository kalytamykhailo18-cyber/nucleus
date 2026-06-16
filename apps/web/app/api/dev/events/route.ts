import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';

/**
 * Test-only seam: read the most recent EviewEvent rows for a given device,
 * filtered by eventType when supplied. Used by the Step 6 integration spec
 * to confirm the worker persisted MQTT messages with the correct row shape.
 *
 * Gated by E2E_HOOKS_SECRET — same pattern as last-email and seed-device.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const secret = env.E2E_HOOKS_SECRET;
  if (!secret) return new NextResponse('not found', { status: 404 });
  const provided = request.headers.get('x-e2e-hook-secret');
  if (provided !== secret) return new NextResponse('not found', { status: 404 });

  const params = request.nextUrl.searchParams;
  const deviceId = params.get('deviceId');
  if (!deviceId) {
    return NextResponse.json({ error: 'missing ?deviceId=' }, { status: 400 });
  }
  const eventType = params.get('eventType');
  const limitRaw = params.get('limit');
  const limit = limitRaw ? Math.max(1, Math.min(50, Number(limitRaw))) : 10;

  const events = await prisma.eviewEvent.findMany({
    where: {
      eviewDeviceId: deviceId,
      ...(eventType ? { eventType } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      eventType: true,
      timestamp: true,
      batteryLevel: true,
      lat: true,
      lng: true,
      buttonType: true,
      statusCode: true,
      alarmCode: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ events });
}

export async function DELETE(request: NextRequest) {
  const secret = env.E2E_HOOKS_SECRET;
  if (!secret) return new NextResponse('not found', { status: 404 });
  const provided = request.headers.get('x-e2e-hook-secret');
  if (provided !== secret) return new NextResponse('not found', { status: 404 });

  const params = request.nextUrl.searchParams;
  const deviceId = params.get('deviceId');
  if (!deviceId) {
    return NextResponse.json({ error: 'missing ?deviceId=' }, { status: 400 });
  }

  const result = await prisma.eviewEvent.deleteMany({
    where: { eviewDeviceId: deviceId },
  });

  return NextResponse.json({ deleted: result.count });
}
