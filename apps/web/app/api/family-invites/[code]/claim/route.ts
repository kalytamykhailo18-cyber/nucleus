import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { consumeFamilyInvite } from '@/lib/family-invite';

export const dynamic = 'force-dynamic';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
): Promise<NextResponse> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { code } = await params;
  const result = await consumeFamilyInvite(code, userId);
  if (result.ok) {
    return NextResponse.json({ ok: true, deviceId: result.deviceId });
  }
  const status =
    result.reason === 'not_found'
      ? 404
      : result.reason === 'already_member'
        ? 200
        : 410;
  return NextResponse.json(
    { ok: false, reason: result.reason },
    { status },
  );
}
