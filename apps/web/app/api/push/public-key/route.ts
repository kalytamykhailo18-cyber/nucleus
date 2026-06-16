import { NextResponse } from 'next/server';
import { env } from '@/lib/env';

/**
 * Returns the VAPID public key the browser uses when subscribing to push.
 * Plain text body so it's trivial to consume from `fetch().then(r => r.text())`.
 * Returns 503 if push isn't configured — better than letting the browser
 * subscribe with a stale or empty key and waste a service-worker slot.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const key = env.VAPID_PUBLIC_KEY;
  if (!key) {
    return new NextResponse('push not configured', { status: 503 });
  }
  return new NextResponse(key, {
    status: 200,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
