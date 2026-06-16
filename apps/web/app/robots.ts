import type { MetadataRoute } from 'next';

/**
 * /robots.txt — Next.js file-based route.
 *
 * Marketing surfaces are fully crawlable; everything behind login or
 * inside admin is excluded so Google does not waste budget on routes
 * that will redirect to /login. Sitemap lives at /sitemap.xml.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/dashboard',
          '/profile',
          '/geofences',
          '/checkout',
          '/onboarding/',
          '/login',
          '/signup',
          '/forgot-password',
          '/reset-password',
        ],
      },
    ],
    sitemap: 'https://sensu.com.mx/sitemap.xml',
    host: 'https://sensu.com.mx',
  };
}
