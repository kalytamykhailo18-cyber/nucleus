import { prisma } from '@/lib/db';
import { env, constants } from '@/lib/env';

/**
 * Email transport — Resend in production, with a parallel test outbox row
 * written to Postgres whenever E2E hooks are enabled. The Playwright suite
 * reads from that outbox table via the gated /api/dev/last-email endpoint
 * to recover reset links without depending on real email delivery.
 *
 * If RESEND_API_KEY is unset (current state until Juan provides keys), we
 * skip Resend entirely and rely on the outbox row alone. This is staging-
 * only behaviour — real prod must have RESEND_API_KEY set, and the outbox
 * writes will be disabled by clearing E2E_HOOKS_SECRET.
 */
export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Recipient suffixes / addresses that NEVER receive a real Resend
 * delivery, even when RESEND_API_KEY is live. These are spec fixtures
 * (Playwright-only accounts) plus the seeded demo / admin Sensu
 * accounts that the test suite repeatedly triggers (Watcher claims,
 * activation flows, etc.). The EmailOutboxTest row still gets
 * written, so specs can verify content via /api/dev/last-email.
 *
 * Without this guard, a single Playwright run firing the family-claim
 * spec dozens of times sent Ustym dozens of "Nuevo familiar en tu
 * Angela" emails to his real Gmail — burned Resend quota and risked
 * domain reputation. Juan 2026-06-17.
 */
const SUPPRESS_REAL_DELIVERY_SUFFIXES = [
  '@nucleus-test.local',
  '@e2e-pair.local',
  '@managed.sensu.internal',
] as const;

function isSuppressedRecipient(to: string): boolean {
  const lower = to.toLowerCase();
  if (SUPPRESS_REAL_DELIVERY_SUFFIXES.some((s) => lower.endsWith(s))) {
    return true;
  }
  // Real Sensu inboxes that forward to humans (Ustym, Juan). The seed
  // script attaches them as Master / Watcher / admin on the demo
  // fixtures, so every spec-driven Watcher claim and every spec login
  // triggers a notification that lands in a real inbox. Block at the
  // transport so neither Resend quota nor inbox noise grows on test
  // traffic.
  const demoEmail = env.NUCLEUS_DEMO_EMAIL?.toLowerCase();
  const adminEmail = env.NUCLEUS_ADMIN_EMAIL?.toLowerCase();
  if (demoEmail && lower === demoEmail) return true;
  if (adminEmail && lower === adminEmail) return true;
  return false;
}

export async function sendEmail({
  to,
  subject,
  text,
  html,
}: SendEmailInput): Promise<void> {
  const apiKey = env.RESEND_API_KEY;
  const mode = env.RESEND_MODE;
  const e2eHooks = env.E2E_HOOKS_SECRET !== undefined;
  const suppressed = isSuppressedRecipient(to);

  if (suppressed) {
    console.info(
      `[email] (suppressed — fixture/seed recipient) to=${to} subject=${subject}`,
    );
  } else if (apiKey && mode === 'live') {
    try {
      const res = await fetch(constants.RESEND_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: env.RESEND_FROM,
          // Route replies to the monitored support inbox — the visible
          // From address stays `noreply@sensu.com.mx` (deliberate signal
          // that automated emails come from a bot), but every "responde
          // este correo" instruction in body copy now actually lands
          // somewhere a human reads. Juan 2026-07-30.
          reply_to: env.NEXT_PUBLIC_SUPPORT_EMAIL,
          to: [to],
          subject,
          text,
          html: html ?? `<pre>${escapeHtml(text)}</pre>`,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '<unreadable>');
        console.error(`[email] Resend ${res.status}: ${body}`);
      }
    } catch (err) {
      console.error('[email] Resend send failed', err);
    }
  } else if (apiKey && mode === 'dev') {
    console.info(
      `[email] (sandbox — RESEND_MODE=dev) to=${to} subject=${subject}`,
    );
  } else {
    console.info(
      `[email] (no-op — RESEND_API_KEY unset) to=${to} subject=${subject}`,
    );
  }

  if (e2eHooks) {
    await prisma.emailOutboxTest.create({
      data: { to: to.toLowerCase(), subject, body: text },
    });
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
