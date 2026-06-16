import { env } from './env';

/**
 * Single source of truth for Sensu's public-facing contact info.
 *
 * Every CTA button, `tel:` link, email mention, and email-template
 * support line in source reads through here. The values come from
 * `.env` via `lib/env.ts` so a number/email rotation is one env-file
 * edit, not a 10-file grep-and-replace.
 *
 * Pattern intentionally mirrors `env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`:
 * server-runtime read, prop-drilled to client components when needed.
 * Module-level getters keep the env access lazy so a build that runs
 * without the env file still completes (the throw lands at first read).
 */

export const sensuContact = {
  callcenter(): { tel: string; display: string } {
    const tel = env.NEXT_PUBLIC_CALLCENTER_PHONE;
    return { tel, display: formatMxPhone(tel) };
  },
  whatsapp(): { tel: string; display: string } {
    const tel = env.NEXT_PUBLIC_WHATSAPP_PHONE;
    return { tel, display: formatMxPhone(tel) };
  },
  supportEmail(): string {
    return env.NEXT_PUBLIC_SUPPORT_EMAIL;
  },
};

/**
 * +528000570180 → "800 057 0180"
 * +525543430729 → "55 4343 0729"
 * Falls back to the raw value if it doesn't match the expected shape.
 */
function formatMxPhone(e164: string): string {
  const digits = e164.replace(/^\+52/, '');
  if (digits.startsWith('800')) {
    const m = digits.match(/^(\d{3})(\d{3})(\d{4})$/);
    if (m) return `${m[1]} ${m[2]} ${m[3]}`;
  }
  const m = digits.match(/^(\d{2})(\d{4})(\d{4})$/);
  if (m) return `${m[1]} ${m[2]} ${m[3]}`;
  return e164;
}
