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

export async function sendEmail({
  to,
  subject,
  text,
  html,
}: SendEmailInput): Promise<void> {
  const apiKey = env.RESEND_API_KEY;
  const mode = env.RESEND_MODE;
  const e2eHooks = env.E2E_HOOKS_SECRET !== undefined;

  if (apiKey && mode === 'live') {
    try {
      const res = await fetch(constants.RESEND_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: env.RESEND_FROM,
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
