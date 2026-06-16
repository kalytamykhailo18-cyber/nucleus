import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { env } from '@/lib/env';
import {
  fireAuraSos,
  fetchAuraAssistances,
  fireAuraCall,
  fireAuraFollowMe,
  isAuraEnabled,
} from '@/lib/aura-client';

/**
 * Test seam for the Aura client. The Aura library is server-only — a
 * direct fetch from a browser context would need cookies + cross-origin
 * gymnastics — so this endpoint exercises each method behind the
 * standard `x-e2e-hook-secret` gate. With no `AURA_X_TOKEN` set,
 * every method should report `{ ok: false, reason: 'disabled' }`,
 * which proves the integration is wired without leaking any real
 * traffic to Aura.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  method: z.enum(['sos', 'assistances', 'calls', 'followme']),
});

const STUB_RFC = 'RIVR990317XXX';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = env.E2E_HOOKS_SECRET;
  if (!secret) return new NextResponse('not found', { status: 404 });
  const provided = request.headers.get('x-e2e-hook-secret');
  if (provided !== secret) return new NextResponse('not found', { status: 404 });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid', message: parsed.error.issues[0]?.message ?? 'invalid' },
      { status: 422 },
    );
  }

  switch (parsed.data.method) {
    case 'sos': {
      const result = await fireAuraSos({
        rfc: STUB_RFC,
        lat: '19.4326',
        long: '-99.1332',
        contacts: ['+525511111111'],
        originPhone: '+525500000001',
      });
      return NextResponse.json({ enabled: isAuraEnabled(), result });
    }
    case 'assistances': {
      const result = await fetchAuraAssistances(STUB_RFC, 1);
      return NextResponse.json({ enabled: isAuraEnabled(), result });
    }
    case 'calls': {
      const result = await fireAuraCall({
        rfc: STUB_RFC,
        phoneNumber: '+525500000001',
        message: 'Aura client smoke probe — never sent in disabled mode.',
      });
      return NextResponse.json({ enabled: isAuraEnabled(), result });
    }
    case 'followme': {
      const result = await fireAuraFollowMe({
        rfc: STUB_RFC,
        lat: '19.4326',
        long: '-99.1332',
        duration: 30,
      });
      return NextResponse.json({ enabled: isAuraEnabled(), result });
    }
  }
}
