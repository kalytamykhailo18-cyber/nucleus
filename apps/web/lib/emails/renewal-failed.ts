import { sendEmail } from '@/lib/email-transport';
import { env } from '@/lib/env';
import { sensuContact } from '@/lib/contact-info';

/**
 * Renewal-failed (dunning) email — fires when the renewal-tick's
 * charge attempt is declined by Stripe. Three variants:
 *
 *   - kind='attempt' → first / second / third attempt declined.
 *     Body: "We tried to charge but couldn't. Update your card to
 *     keep the service going. Next attempt: <date>." Light touch,
 *     no service interruption yet.
 *
 *   - kind='past_due' → all attempts exhausted, subscription flipped
 *     to PAST_DUE, grace period started. Body: "We've paused billing.
 *     Update your card before <date> to keep monitoring active."
 *
 *   - kind='cancelled' → grace period expired, subscription
 *     auto-CANCELLED. Body: "We've cancelled. Reactivate anytime."
 */
export type RenewalFailedKind = 'attempt' | 'past_due' | 'cancelled';

export async function sendRenewalFailedEmail(input: {
  to: string;
  firstName: string | null;
  amountCentavos: number;
  declineReason: string | null;
  kind: RenewalFailedKind;
  /** For kind='attempt': when we will try again.
   *  For kind='past_due': when the auto-cancel fires.
   *  Unused for kind='cancelled'. */
  nextActionDate: Date | null;
}): Promise<void> {
  const name = (input.firstName ?? '').trim() || 'Hola';
  const amount = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
  }).format(input.amountCentavos / 100);
  const nextActionDateText = input.nextActionDate
    ? input.nextActionDate.toLocaleDateString('es-MX', {
        timeZone: 'America/Mexico_City',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;
  const profileUrl = `${env.AUTH_URL.replace(/\/$/, '')}/profile`;
  const callcenter = sensuContact.callcenter();
  const reasonNote = input.declineReason
    ? ` (motivo del banco: ${input.declineReason})`
    : '';

  let subject: string;
  let bodyLead: string;
  let bodyAction: string;
  if (input.kind === 'attempt') {
    subject = 'Sensu — no pudimos cobrar tu renovación';
    bodyLead = `Intentamos cobrar ${amount} pero el banco rechazó el cargo${reasonNote}.`;
    bodyAction = nextActionDateText
      ? `Vamos a reintentar el ${nextActionDateText}. Si quieres adelantar la solución, actualiza la tarjeta en tu panel:`
      : 'Actualiza la tarjeta en tu panel para que el siguiente intento pase:';
  } else if (input.kind === 'past_due') {
    subject = 'Sensu — servicio en pausa por pago vencido';
    bodyLead = `Tras varios intentos no pudimos cobrar ${amount}${reasonNote}. Pausamos el servicio para protegerte.`;
    bodyAction = nextActionDateText
      ? `Tienes hasta el ${nextActionDateText} para actualizar la tarjeta antes de que cancelemos automáticamente. Hazlo desde tu panel:`
      : 'Actualiza la tarjeta desde tu panel para reactivar el servicio:';
  } else {
    subject = 'Sensu — tu suscripción quedó cancelada';
    bodyLead = `Como no fue posible cobrar ${amount}${reasonNote}, cancelamos tu suscripción.`;
    bodyAction = 'Cuando estés listo para volver, vuelve a entrar a tu panel:';
  }

  const text = [
    `Hola, ${name}.`,
    '',
    bodyLead,
    '',
    bodyAction,
    `  ${profileUrl}`,
    '',
    `Si necesitas ayuda inmediata, llámanos al ${callcenter.display}.`,
    '',
    '— El equipo de Sensu',
  ].join('\n');
  const html = `
    <p>Hola, ${name}.</p>
    <p>${bodyLead}</p>
    <p>${bodyAction}</p>
    <p><a href="${profileUrl}">${profileUrl}</a></p>
    <p>Si necesitas ayuda inmediata, llámanos al <a href="tel:${callcenter.tel}">${callcenter.display}</a>.</p>
    <p>— El equipo de Sensu</p>
  `;
  try {
    await sendEmail({ to: input.to, subject, text, html });
  } catch (err) {
    console.error('sendRenewalFailedEmail failed (non-fatal)', err);
  }
}
