import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email-transport';
import { env } from '@/lib/env';
import { formatAmountMXN } from '@/lib/plans';

/**
 * Abandoned-cart nudge — fires once per Subscription that has been
 * PENDING_PAYMENT for >24h without an existing ABANDONED_CART
 * DripEmailLog row. The buyer reached the Stripe card step but never
 * confirmed (Stripe shows it as an Incomplete PaymentIntent). The
 * email links them back to /checkout in resume mode so they can finish
 * with the card details and no second account-creation step.
 *
 * Pair this with the DripEmailLog @@unique([subscriptionId, kind])
 * constraint so the cron tick can call this safely on every pass —
 * the row write inside `runDripEmailTick` is what enforces at-most-once
 * delivery, not anything inside this file.
 */
export async function sendAbandonedCartEmail(
  subscriptionId: string,
): Promise<void> {
  const sub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: {
      amountPaidCentavos: true,
      user: { select: { email: true, fullName: true } },
      plan: { select: { name: true, type: true } },
    },
  });
  if (!sub || !sub.user.email) return;

  const firstName = (sub.user.fullName ?? '').split(' ')[0]?.trim() || 'Hola';
  const planQuery = sub.plan.type
    ? `?plan=${encodeURIComponent(sub.plan.type)}`
    : '';
  const resumeUrl = `${env.AUTH_URL.replace(/\/$/, '')}/checkout${planQuery}`;
  const totalLabel =
    sub.amountPaidCentavos !== null
      ? formatAmountMXN(sub.amountPaidCentavos)
      : null;

  const subject = `${firstName}, tu Angela está esperando`;
  const text = [
    `Hola, ${firstName}.`,
    '',
    `Empezaste a contratar el ${sub.plan.name} y no terminaste el pago. Tu lugar sigue reservado.`,
    totalLabel ? `Total pendiente: ${totalLabel}.` : '',
    '',
    'Termina la compra en un toque — no tienes que volver a llenar tus datos:',
    '',
    `  → ${resumeUrl}`,
    '',
    'Si tuviste una duda durante el pago, responde este correo y te ayudamos en el momento. También puedes llamarnos sin costo al 800 057 0180.',
    '',
    '— Sensu',
  ]
    .filter(Boolean)
    .join('\n');
  const html = `
    <p>Hola, ${firstName}.</p>
    <p>Empezaste a contratar el <strong>${sub.plan.name}</strong> y no terminaste el pago. Tu lugar sigue reservado.</p>
    ${totalLabel ? `<p>Total pendiente: <strong>${totalLabel}</strong>.</p>` : ''}
    <p>Termina la compra en un toque — no tienes que volver a llenar tus datos:</p>
    <p><a href="${resumeUrl}">${resumeUrl}</a></p>
    <p>Si tuviste una duda durante el pago, responde este correo y te ayudamos en el momento. También puedes llamarnos sin costo al <a href="tel:+528000570180">800 057 0180</a>.</p>
    <p>— Sensu</p>
  `;

  await sendEmail({ to: sub.user.email, subject, text, html });
}
