import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPublicInvite, revokeInvite } from '@/lib/family-invite';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
): Promise<NextResponse> {
  const { code } = await params;
  const view = await getPublicInvite(code);
  if (!view) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json(view);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
): Promise<NextResponse> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { code } = await params;
  const removed = await revokeInvite(code, userId);
  if (!removed) {
    return NextResponse.json({ error: 'not_found_or_consumed' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
