import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  ensureFamilyShare,
  isMasterUser,
  rotateShareCode,
} from '@/lib/family-share';

export const dynamic = 'force-dynamic';

async function requireMasterUserId(): Promise<string | null> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return null;
  if (!(await isMasterUser(userId))) return null;
  return userId;
}

export async function GET(): Promise<NextResponse> {
  const userId = await requireMasterUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const share = await ensureFamilyShare(userId);
  return NextResponse.json(share);
}

export async function POST(): Promise<NextResponse> {
  // POST rotates the share password while keeping the Client ID stable.
  const userId = await requireMasterUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const share = await rotateShareCode(userId);
  return NextResponse.json(share);
}
