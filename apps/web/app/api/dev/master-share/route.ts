import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { ensureFamilyShare } from '@/lib/family-share';

/**
 * Test seam: returns the demo Master's `clientId` + `shareCode` plus
 * one of their MASTER device IMEIs. Lets the family-signup Playwright
 * spec drive the "Soy familiar" flow without scraping /profile to
 * discover the credentials.
 *
 * Gated by E2E_HOOKS_SECRET so it never lands as a production
 * foot-gun.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const secret = env.E2E_HOOKS_SECRET;
  if (!secret) return new NextResponse('not found', { status: 404 });
  const provided = request.headers.get('x-e2e-hook-secret');
  if (provided !== secret) return new NextResponse('not found', { status: 404 });

  const email = request.nextUrl.searchParams.get('email');
  if (!email) {
    return NextResponse.json(
      { error: 'email required' },
      { status: 400 },
    );
  }
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "User" WHERE LOWER(email) = ${email.toLowerCase()} LIMIT 1
  `;
  const userId = rows[0]?.id;
  if (!userId) {
    return NextResponse.json({ error: 'user not found' }, { status: 404 });
  }

  const share = await ensureFamilyShare(userId);
  const masterDevice = await prisma.userDevice.findFirst({
    where: { userId, role: 'MASTER' },
    orderBy: { isPrimary: 'desc' },
    select: { eviewDeviceId: true },
  });
  if (!masterDevice) {
    return NextResponse.json({ error: 'no master device' }, { status: 404 });
  }
  return NextResponse.json({
    clientId: share.clientId,
    shareCode: share.shareCode,
    deviceId: masterDevice.eviewDeviceId,
  });
}
