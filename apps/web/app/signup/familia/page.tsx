import { redirect } from 'next/navigation';

/**
 * Alias for the natural-Spanish typo /signup/familia.
 *
 * Juan tripped on this 2026-05-18 — "familiar" is technically correct
 * (the relative as a person) but "familia" (family) is just as easy
 * to guess. Permanent redirect so both spellings land on the same page.
 */
export default function FamiliaAliasPage(): never {
  redirect('/signup/familiar');
}
