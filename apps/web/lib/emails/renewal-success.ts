import { sendEmail } from '@/lib/email-transport';
import { env } from '@/lib/env';

/**
 * Renewal-success email — fires when the renewal-tick charges the
 * customer's saved card and Stripe returns `succeeded`. Confirms the
 * amount + next renewal date so the family knows the service is
 * continuing without surprise.
 *
 * Lighter touch than the reminder: short paragraph, one link to
 * /profile in case they want to manage the plan.
 */
export async function sendRenewalSuccessEmail(input: {
  to: string;
  firstName: string | null;
  amountCentavos: number;
  nextRenewalDate: Date;
  cadenceLabel: string;
}): Promise<void> {
  const name = (input.firstName ?? '').trim() || 'Hola';
  const amount = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
  }).format(input.amountCentavos / 100);
  const date = input.nextRenewalDate.toLocaleDateString('es-MX', {
    timeZone: 'America/Mexico_City',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const profileUrl = `${env.AUTH_URL.replace(/\/$/, '')}/profile`;

  const subject = 'Sensu — pago recibido, gracias';
  const text = [
    `Hola, ${name}.`,
    '',
    `Acabamos de cobrar ${amount} por tu plan ${input.cadenceLabel}.`,
    `Tu próxima renovación será el ${date}.`,
    '',
    `Gestiona el plan o el método de pago en ${profileUrl}.`,
    '',
    '— El equipo de Sensu',
  ].join('\n');
  const html = `
    <p>Hola, ${name}.</p>
    <p>Acabamos de cobrar <strong>${amount}</strong> por tu plan <strong>${input.cadenceLabel}</strong>.</p>
    <p>Tu próxima renovación será el <strong>${date}</strong>.</p>
    <p>Gestiona el plan o el método de pago en <a href="${profileUrl}">tu panel</a>.</p>
    <p>— El equipo de Sensu</p>
  `;
  try {
    await sendEmail({ to: input.to, subject, text, html });
  } catch (err) {
    console.error('sendRenewalSuccessEmail failed (non-fatal)', err);
  }
}
