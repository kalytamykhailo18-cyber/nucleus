import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { lookupByDeviceId } from '@/lib/callcenter-lookup';

/**
 * Admin-session counterpart of /api/callcenter/lookup. Same enrichment
 * payload, but auth is "logged-in admin" rather than the shared
 * `x-callcenter-token` header — so the operator-dashboard UI can call
 * it directly from the browser without exposing the token.
 *
 * Inline auth check (not `requireAdmin()`): we want a JSON 401/403
 * response, not a `/dashboard` redirect, since callers are fetch()'ing
 * from the operator board.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!user || (user.role !== 'ADMIN' && user.role !== 'CALLCENTER')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const deviceId = request.nextUrl.searchParams.get('deviceId');
  if (!deviceId) {
    return NextResponse.json({ error: 'deviceId required' }, { status: 400 });
  }
  const result = await lookupByDeviceId(deviceId);
  if (!result) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json(result);
}
