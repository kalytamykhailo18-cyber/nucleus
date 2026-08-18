import { NextResponse } from 'next/server';
import { env } from '@/lib/env';

/**
 * Digital Asset Links — Android TWA verification endpoint.
 *
 * Google Chrome checks this JSON when launching the Trusted Web
 * Activity to confirm the Android app is legitimately linked to
 * app.sensu.com.mx. Without a valid response, Chrome shows an
 * address bar at the top of the app (breaking the "native" feel)
 * or refuses to launch the TWA at all.
 *
 * Reachable at `/.well-known/assetlinks.json` via the rewrite in
 * next.config.mjs (Next.js folder names starting with a dot are
 * finicky, so we serve the file through a normal API route and
 * alias the well-known path with a framework-level rewrite).
 *
 * Content lives in an env var (`NUCLEUS_ANDROID_ASSETLINKS_JSON`) so
 * a fingerprint rotation only needs an env swap + container restart,
 * not a code redeploy. Format is the standard Google Digital Asset
 * Links array — an array of objects with `relation`, `target.namespace`,
 * `target.package_name`, and `target.sha256_cert_fingerprints`.
 *
 * When the env is empty (initial deploy before the Android keystore
 * exists), we return `[]` so Chrome cleanly fails the verification
 * instead of crashing. Both the upload-key fingerprint and the
 * Google-managed app-signing-key fingerprint should be listed here
 * once the app hits Play Console.
 */
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const raw = env.NUCLEUS_ANDROID_ASSETLINKS_JSON;
  if (!raw || raw.trim() === '') {
    return NextResponse.json([], {
      headers: { 'cache-control': 'public, max-age=300' },
    });
  }
  try {
    const parsed = JSON.parse(raw);
    return NextResponse.json(parsed, {
      headers: { 'cache-control': 'public, max-age=300' },
    });
  } catch {
    // Malformed env: still return an empty array rather than 500 so
    // Chrome degrades gracefully. Operator sees the misconfig via the
    // TWA address bar showing up + logs.
    return NextResponse.json([], {
      headers: { 'cache-control': 'public, max-age=60' },
    });
  }
}
