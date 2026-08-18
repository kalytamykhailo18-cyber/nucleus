import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { prisma } from '@/lib/db';
import { sendWelcomeDemoEmail } from '@/lib/emails/welcome-demo';

/**
 * Admin-only resend of the demo welcome email (Juan 2026-06-30).
 *
 * Triggered from the per-row "Reenviar correo" button on /admin/
 * registrations when a row's `questionnaireCompleted` is false — the
 * customer signed up but never finished onboarding. Mints a fresh
 * `PasswordReset` token and re-sends `sendWelcomeDemoEmail` so the
 * customer gets a working link back into the flow.
 *
 * Idempotent in the sense that nothing breaks on repeated calls — each
 * call lands a new PasswordReset row and a new email. The previous
 * tokens stay valid until their own TTL expires; this is the same
 * shape /forgot-password uses.
 *
 * Returns the User email + emit timestamp so the admin UI can show a
 * neutral "enviado a X" confirmation without re-fetching the page.
 */
export const dynamic = 'force-dynamic';

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ subscriptionId: string }> },
): Promise<NextResponse> {
  await requireAdmin();
  const { subscriptionId } = await ctx.params;
  if (!subscriptionId) {
    return NextResponse.json({ error: 'missing_subscription' }, { status: 400 });
  }

  const sub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: {
      user: {
        select: {
          id: true,
          email: true,
          fullName: true,
          questionnaireCompleted: true,
        },
      },
    },
  });
  if (!sub) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (sub.user.questionnaireCompleted) {
    // No-op: the questionnaire is already done; resending would be
    // confusing. The button only renders on pending rows but a stale
    // tab could still POST after the user finishes — bounce honestly.
    return NextResponse.json(
      { error: 'already_completed' },
      { status: 409 },
    );
  }

  await sendWelcomeDemoEmail({
    userId: sub.user.id,
    email: sub.user.email,
    fullName: sub.user.fullName ?? sub.user.email,
  });

  return NextResponse.json({
    ok: true,
    email: sub.user.email,
    sentAt: new Date().toISOString(),
  });
}
