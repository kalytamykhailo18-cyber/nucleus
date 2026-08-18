import { cookies } from 'next/headers';

/**
 * Resolves the strict-vs-lenient view for an admin page.
 *
 * Default is STRICT (Juan 2026-06-23): the real admin should never see
 * `@nucleus-test.local` or `demo+` rows. Opt-out is either:
 *   - `?vista=all` on the URL  → lenient for that page load
 *   - `?vista=real` on the URL → strict for that page load (explicit)
 *   - `nucleus_vista_default=all` cookie → lenient default (used by
 *     the Playwright global-setup so the spec suite continues to
 *     assert against seeded demo rows without per-URL rewrites)
 *
 * URL beats cookie. Strict beats lenient when both are explicit.
 */
export async function resolveStrictAdminView(
  vista: string | undefined,
): Promise<boolean> {
  if (vista === 'real') return true;
  if (vista === 'all') return false;
  const jar = await cookies();
  const cookieDefault = jar.get('nucleus_vista_default')?.value;
  return cookieDefault !== 'all';
}
