import type { MetadataRoute } from 'next';

/**
 * /sitemap.xml — Next.js file-based route.
 *
 * Lists every public marketing surface so Google can index sensu.com.mx
 * cleanly. Anything behind login (dashboard / profile / geofences) is
 * intentionally absent — those would just redirect to /login if crawled.
 *
 * Last-modified is set to today on every render. That is conservative —
 * Google interprets it as "this URL was reviewed recently" rather than
 * "this URL changed recently"; we will swap to per-route timestamps if
 * crawl budget becomes a real constraint.
 */

const BASE_URL = 'https://sensu.com.mx';

const MARKETING_ROUTES: Array<{
  path: string;
  priority: number;
  changeFrequency: 'daily' | 'weekly' | 'monthly';
}> = [
  { path: '/', priority: 1.0, changeFrequency: 'weekly' },
  { path: '/como-funciona', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/planes', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/soporte', priority: 0.7, changeFrequency: 'weekly' },
  { path: '/adultos-mayores', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/ninos', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/mujeres', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/trabajadores', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/para-mi', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/especializado', priority: 0.8, changeFrequency: 'monthly' },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return MARKETING_ROUTES.map((r) => ({
    url: `${BASE_URL}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
