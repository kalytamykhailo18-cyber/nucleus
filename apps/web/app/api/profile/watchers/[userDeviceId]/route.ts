import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { revokeWatcher } from '@/lib/family-watchers';

export const dynamic = 'force-dynamic';

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ userDeviceId: string }> },
): Promise<NextResponse> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { userDeviceId } = await context.params;
  const result = await revokeWatcher(userId, userDeviceId);
  if (!result.ok) {
    const status = result.reason === 'not_found' ? 404 : 403;
    return NextResponse.json({ error: result.reason }, { status });
  }
  return NextResponse.json({ ok: true });
}
