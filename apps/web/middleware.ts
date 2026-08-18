import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import authConfig from './auth.config';
import {
  SIGNUP_SOURCE_COOKIE,
  SIGNUP_SOURCE_MAX_AGE_SECONDS,
  SIGNUP_SOURCE_PATTERN,
} from './lib/signup-source';

// Edge-safe Auth.js instance — no DB, no Node crypto. Sufficient for reading
// the session JWT off the cookie, which is all middleware needs.
const { auth } = NextAuth(authConfig);

const PROTECTED_PREFIXES = ['/dashboard', '/profile', '/geofences', '/admin', '/company'];
// /signup itself is intentionally OFF this list (Juan 2026-06-22): the
// route is now a 307 to /planes for everyone, authed or not. Bouncing
// authed users to /dashboard here would shadow that redirect and break
// the closure contract.
const PUBLIC_AUTH_ROUTES = ['/login', '/signup/familiar', '/signup/claim'];

// Marketing-site cutover (Juan 2026-06-29). When
// NUCLEUS_MARKETING_OFFLOADED=on, every marketing page below 301s to
// the same path on NUCLEUS_MARKETING_SITE_BASE_URL. `/` is excluded
// because it falls back to the slim-landing gateway (login + IMEI
// activate cards) instead of redirecting away — that's the only
// page that needs to keep serving Nucleus chrome for returning
// customers who type the bare domain. /checkout is also excluded
// because Stripe payment flow must stay on Nucleus.
const MARKETING_OFFLOAD_PATHS = new Set([
  '/como-funciona',
  '/planes',
  '/casos',
  '/soporte',
  '/pemex',
  '/adultos-mayores',
  '/ninos',
  '/mujeres',
  '/trabajadores',
  '/especializado',
  '/para-mi',
]);

export default auth((req) => {
  const { pathname, searchParams } = req.nextUrl;

  // Marketing-offload redirect first — short-circuits all other
  // middleware logic so a non-Nucleus marketing page never costs us
  // a session lookup or cookie write.
  if (
    process.env.NUCLEUS_MARKETING_OFFLOADED === 'on' &&
    MARKETING_OFFLOAD_PATHS.has(pathname)
  ) {
    const target = (
      process.env.NUCLEUS_MARKETING_SITE_BASE_URL ?? 'https://sensu.com.mx'
    ).replace(/\/$/, '');
    const url = new URL(`${target}${pathname}`);
    // Forward any query string so source-tracked links keep their
    // attribution on the marketing side.
    for (const [k, v] of searchParams) url.searchParams.set(k, v);
    return NextResponse.redirect(url, 301);
  }

  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  );
  const isAuthRoute = PUBLIC_AUTH_ROUTES.includes(pathname);

  // Build the auth response first so the cookie set below rides on the
  // same response.
  let response: NextResponse;
  if (!req.auth && isProtected) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    response = NextResponse.redirect(url);
  } else if (req.auth && isAuthRoute) {
    // Authed user hitting /login, /signup, etc. Route by role so admins
    // land on `/` (inline CMS) and company-admins on `/company`. Full
    // company-membership resolution needs Prisma (not available in the
    // Edge runtime), so middleware handles the role-tier paths it can
    // see from the JWT and falls through to /dashboard for the rest —
    // /dashboard then 307s company-admins to /company at the page level.
    const role = (req.auth.user as { role?: 'USER' | 'ADMIN' | 'CALLCENTER' } | undefined)
      ?.role;
    const url = req.nextUrl.clone();
    // ADMIN → marketing landing (inline-CMS surface).
    // CALLCENTER → dispatcher hub.
    // FAMILY / company-admin → /dashboard (which 307s company-admins
    // to /company at the page level).
    url.pathname =
      role === 'ADMIN'
        ? '/'
        : role === 'CALLCENTER'
          ? '/admin/operator'
          : '/dashboard';
    url.search = '';
    response = NextResponse.redirect(url);
  } else {
    response = NextResponse.next();
  }

  // Sticky-first signup-source cookie (Phase A+ #2). Only sets when the
  // request carries a whitelisted ?source= AND no cookie exists yet —
  // preserves the first marketing source so a later audience-page CTA
  // click does not clobber an ad-click attribution.
  const rawSource = searchParams.get('source');
  if (rawSource) {
    const trimmed = rawSource.trim().toLowerCase();
    const existing = req.cookies.get(SIGNUP_SOURCE_COOKIE)?.value;
    if (!existing && SIGNUP_SOURCE_PATTERN.test(trimmed)) {
      response.cookies.set(SIGNUP_SOURCE_COOKIE, trimmed, {
        maxAge: SIGNUP_SOURCE_MAX_AGE_SECONDS,
        path: '/',
        sameSite: 'lax',
        httpOnly: false,
      });
    }
  }

  // Sticky-first referral code cookie (Phase A+ #1, 2026-06-16). Same
  // shape as signup-source: a `?ref=CODE` on any landing page sets
  // the cookie if unset, so a buyer who clicks through audience pages
  // before /signup keeps the referrer attribution intact.
  const rawRef = searchParams.get('ref');
  if (rawRef) {
    const trimmed = rawRef.trim().toUpperCase();
    const existing = req.cookies.get('nucleus_referral_code')?.value;
    if (!existing && /^[A-Z]{1,12}-[A-Z0-9]{4,16}$/.test(trimmed)) {
      response.cookies.set('nucleus_referral_code', trimmed, {
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/',
        sameSite: 'lax',
        httpOnly: false,
      });
    }
  }

  return response;
});

export const config = {
  matcher: [
    // Auth-gated app routes.
    '/dashboard/:path*',
    '/profile/:path*',
    '/geofences/:path*',
    '/admin/:path*',
    '/company/:path*',
    '/login',
    '/signup',
    '/signup/familiar',
    '/signup/claim',
    // Signup-source capture surface — root, partner, checkout, audience pages.
    '/',
    '/pemex',
    '/checkout',
    '/adultos-mayores',
    '/ninos',
    '/mujeres',
    '/trabajadores',
    '/especializado',
    '/para-mi',
    // Marketing-offload candidates added 2026-06-30 so the cutover
    // middleware block can intercept them. Harmless when the flag is
    // off because middleware just falls through to NextResponse.next().
    '/como-funciona',
    '/planes',
    '/casos',
    '/soporte',
  ],
};
