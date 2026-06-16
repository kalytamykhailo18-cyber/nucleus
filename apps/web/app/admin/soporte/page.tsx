import { redirect } from 'next/navigation';

/**
 * /admin/soporte was the legacy modal-based CRUD page. As of
 * 2026-05-29 the inline CMS lives on /soporte itself (pencils on
 * every field + Nueva guía button + trash-per-card), so this route
 * just bounces. Any old links from emails or bookmarks land
 * on the canonical surface.
 */
export const dynamic = 'force-dynamic';

export default function LegacyAdminSoporteRedirect(): never {
  redirect('/soporte');
}
