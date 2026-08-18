import { NextResponse } from 'next/server';
import { env } from '@/lib/env';

/**
 * Apple App Site Association — iOS Universal Links + App Clip
 * verification endpoint.
 *
 * iOS fetches this JSON on the first app launch (and periodically
 * thereafter) to confirm the app is legitimately linked to
 * app.sensu.com.mx. Without a valid response, Universal Links fall
 * back to opening in Safari instead of the native app, defeating
 * the whole "tap the notification → open the app" flow.
 *
 * Reachable at `/.well-known/apple-app-site-association` via the
 * rewrite in next.config.mjs. Must be served over HTTPS (already
 * true — nginx + Let's Encrypt), with content-type
 * `application/json` (Next.js JSON responder handles that), and
 * MUST NOT have a `.json` extension in the URL path (Apple's
 * fetcher rejects it — hence the rewrite from the dot-well-known
 * form to the extensionless API route).
 *
 * Content lives in an env var (`NUCLEUS_IOS_APPLE_APP_SITE_ASSOCIATION`)
 * so a Team ID + Bundle ID update only needs an env swap + container
 * restart, not a code redeploy. Format is the standard Apple AASA
 * object with `applinks.details[]` carrying `appIDs` (formatted as
 * `<TeamID>.<BundleID>`) and the URL `paths` the app should handle.
 *
 * When the env is empty (initial deploy before Juan's Apple Team
 * ID is captured), we return `{}` so iOS cleanly fails the
 * verification instead of crashing. Once Juan hands over the Team
 * ID from App Store Connect, populate the env with something like
 *
 *   {
 *     "applinks": {
 *       "details": [{
 *         "appIDs": ["TEAMID.com.sensu.app"],
 *         "components": [{ "/": "*" }]
 *       }]
 *     }
 *   }
 *
 * Mirrors the Android `assetlinks.json` route shape so the pattern
 * is uniform across the two platform verification endpoints.
 */
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const raw = env.NUCLEUS_IOS_APPLE_APP_SITE_ASSOCIATION;
  if (!raw || raw.trim() === '') {
    return NextResponse.json(
      {},
      { headers: { 'cache-control': 'public, max-age=300' } },
    );
  }
  try {
    const parsed = JSON.parse(raw);
    return NextResponse.json(parsed, {
      headers: { 'cache-control': 'public, max-age=300' },
    });
  } catch {
    // Malformed env: return empty object rather than 500 so iOS
    // degrades gracefully. Operator sees the misconfig via the
    // Universal Link opening in Safari instead of the app.
    return NextResponse.json(
      {},
      { headers: { 'cache-control': 'public, max-age=60' } },
    );
  }
}
