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
const PUBLIC_AUTH_ROUTES = ['/login', '/signup', '/signup/familiar', '/signup/claim'];

export default auth((req) => {
  const { pathname, searchParams } = req.nextUrl;
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
    const role = (req.auth.user as { role?: 'USER' | 'ADMIN' } | undefined)
      ?.role;
    const url = req.nextUrl.clone();
    url.pathname = role === 'ADMIN' ? '/' : '/dashboard';
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
  ],
};
