import { sendEmail } from '@/lib/email-transport';
import { env } from '@/lib/env';
import { sensuContact } from '@/lib/contact-info';

/**
 * Renewal reminder — fires 7 days before `Subscription.currentPeriodEnd`.
 *
 * Customer hears about the upcoming charge BEFORE the bank does. Cuts
 * the "wait, what's this charge?" support email + reduces dispute
 * rate. The body lists the amount, the renewal date, and a link to
 * /profile where they can swap cadence or cancel before being billed.
 *
 * Idempotent at the caller — the renewal-tick checks
 * `Subscription.renewalReminderSentAt` to avoid double-sending.
 */
export async function sendRenewalReminderEmail(input: {
  to: string;
  firstName: string | null;
  amountCentavos: number;
  renewalDate: Date;
  cadenceLabel: string;
}): Promise<void> {
  const name = (input.firstName ?? '').trim() || 'Hola';
  const amount = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
  }).format(input.amountCentavos / 100);
  const date = input.renewalDate.toLocaleDateString('es-MX', {
    timeZone: 'America/Mexico_City',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const profileUrl = `${env.AUTH_URL.replace(/\/$/, '')}/profile`;
  const callcenter = sensuContact.callcenter();

  const subject = `Tu Sensu se renueva el ${date}`;
  const text = [
    `Hola, ${name}.`,
    '',
    `Esta es una nota amistosa: tu plan ${input.cadenceLabel} se renueva el ${date}.`,
    `Cobraremos ${amount} a la tarjeta que tienes registrada.`,
    '',
    'No necesitas hacer nada — el cobro corre automático. Si quieres pausar,',
    'cambiar de cadencia, o actualizar la tarjeta, entra a tu panel antes',
    'de la fecha de renovación:',
    '',
    `  ${profileUrl}`,
    '',
    `Si necesitas ayuda, llámanos al ${callcenter.display}.`,
    '',
    '— El equipo de Sensu',
  ].join('\n');
  const html = `
    <p>Hola, ${name}.</p>
    <p>Esta es una nota amistosa: tu plan <strong>${input.cadenceLabel}</strong> se renueva el <strong>${date}</strong>.</p>
    <p>Cobraremos <strong>${amount}</strong> a la tarjeta que tienes registrada.</p>
    <p>No necesitas hacer nada — el cobro corre automático. Si quieres pausar, cambiar de cadencia, o actualizar la tarjeta, entra a tu panel antes de la fecha de renovación:</p>
    <p><a href="${profileUrl}">${profileUrl}</a></p>
    <p>Si necesitas ayuda, llámanos al <a href="tel:${callcenter.tel}">${callcenter.display}</a>.</p>
    <p>— El equipo de Sensu</p>
  `;
  try {
    await sendEmail({ to: input.to, subject, text, html });
  } catch (err) {
    console.error('sendRenewalReminderEmail failed (non-fatal)', err);
  }
}
