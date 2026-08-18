import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { resolveLandingPath } from '@/lib/post-login-destination';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const session = await auth();
  const role = (session?.user as { role?: 'USER' | 'ADMIN' | 'CALLCENTER' } | undefined)?.role ?? null;
  const userId = (session?.user as { id?: string } | undefined)?.id ?? null;
  const url = await resolveLandingPath({ userId, role });
  return NextResponse.json({ url });
}
