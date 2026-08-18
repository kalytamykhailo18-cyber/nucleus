import { redirect } from 'next/navigation';

/**
 * Juan 2026-06-22: the plain email + password signup path is closed.
 * Every new account now starts on /planes so the buyer goes through
 * the payment flow before a User row is minted. This route stays as
 * a 307 redirect so legacy bookmarks, marketing emails, and external
 * links land on the right entry point.
 *
 * Family-member flows (/signup/familiar, /signup/claim, /signup/familia)
 * are untouched — those redeem against an existing paid Master device.
 */
export const dynamic = 'force-dynamic';

export default function SignupPage(): never {
  redirect('/planes');
}
