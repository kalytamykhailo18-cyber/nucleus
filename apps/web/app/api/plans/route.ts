import { NextResponse } from 'next/server';
import { fetchActivePlans } from '@/lib/plans';

/**
 * Public list of active plans. Used by the homepage plan picker and the
 * checkout page to render plan cards. No auth — these are marketing
 * surfaces.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const plans = await fetchActivePlans();
  return NextResponse.json({ plans });
}
