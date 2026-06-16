import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { lookupByDeviceId, lookupByPhone } from '@/lib/callcenter-lookup';

/**
 * Caller-ID enrichment for the call-center dispatch desk (Juan
 * 2026-05-15). The PBX hands us either the inbound deviceId (Eview
 * pendant SOS) or the caller's phone (app-side SOS); we return the
 * family roster + medical notes the dispatcher needs to triage.
 *
 * Auth: shared bearer header `x-callcenter-token` matching the env
 * var. No session — the dispatch system is a peer service, not a user.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = env.CALLCENTER_API_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'disabled' }, { status: 404 });
  }
  const provided = request.headers.get('x-callcenter-token');
  if (!provided || provided !== token) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const deviceId = request.nextUrl.searchParams.get('deviceId');
  const phone = request.nextUrl.searchParams.get('phone');
  if (!deviceId && !phone) {
    return NextResponse.json(
      { error: 'deviceId or phone required' },
      { status: 400 },
    );
  }

  const result = deviceId
    ? await lookupByDeviceId(deviceId)
    : await lookupByPhone(phone!);
  if (!result) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json(result);
}
