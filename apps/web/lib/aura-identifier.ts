/**
 * Aura affiliate identifier builder — Juan 2026-05-19.
 *
 * Aura's tech team accepts an RFC-shaped string keyed on CURP + an
 * optional 3-char homoclave. When the customer has no homoclave we
 * append "XXX" as a fallback that Aura whitelists for our integration.
 *
 *   CURP        = 4 letters + AAMMDD + H/M + 5 letters + alphanumeric + digit (18)
 *   First 10    = 4 letters + AAMMDD                                          (the RFC stem)
 *   Homoclave   = 3-char taxpayer suffix issued by SAT (optional in our flow)
 *
 * Returns null when CURP is missing or shorter than 10 chars — callers
 * should treat that as "we cannot yet enroll this user with Aura" and
 * surface the gap on the admin view.
 */
export function buildAuraIdentifier(
  curp: string | null | undefined,
  rfcHomoclave: string | null | undefined,
): string | null {
  if (!curp) return null;
  const stem = curp.trim().toUpperCase().slice(0, 10);
  if (stem.length < 10) return null;
  const homoclave = (rfcHomoclave ?? '').trim().toUpperCase();
  const suffix = /^[A-Z0-9]{3}$/.test(homoclave) ? homoclave : 'XXX';
  return stem + suffix;
}
