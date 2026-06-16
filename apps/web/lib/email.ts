/**
 * Email normalization — mirrors sensu-api/core/database.py:_normalize_email.
 *
 * The User.email column has a case-sensitive unique index in the production
 * Postgres, but mobile keyboards auto-capitalize the first letter, so we
 * always store and look up emails in lowercased form. Existing legacy rows
 * that were inserted mixed-case are matched at read time via
 * `LOWER(email) = $1`.
 */
export function normalizeEmail(email: string | null | undefined): string | null {
  if (email == null) return null;
  const normalized = email.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}
