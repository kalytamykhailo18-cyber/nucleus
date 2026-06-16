import { sendEmail } from '@/lib/email-transport';
import { env } from '@/lib/env';

/**
 * Safety-net email — Juan's May 7 doc.
 *
 * Whenever someone claims an IMEI via /signup/claim, every prior
 * account on the same IMEI receives this notification. It is the
 * family's recourse against an unauthorized claim: if the new name on
 * the message isn't recognized, they can ask Sensu to deactivate the
 * IMEI from the admin panel, which blocks any further claims while
 * existing accounts keep working.
 */
export async function sendNewMemberJoinedEmail(input: {
  to: string;
  recipientFirstName: string;
  newMemberName: string;
  imei: string;
}): Promise<void> {
  const dashboardUrl = `${env.AUTH_URL.replace(/\/$/, '')}/profile`;

  const subject = `Nuevo familiar en tu Angela · ${input.newMemberName}`;
  const text = [
    `Hola, ${input.recipientFirstName}.`,
    '',
    `Acaba de unirse un nuevo familiar a la Angela (IMEI ${input.imei}):`,
    `  ${input.newMemberName}`,
    '',
    'Ya tiene acceso al panel familiar — ve la ubicación, las alertas y puede coordinar igual que tú.',
    '',
    `¿No reconoces el nombre? Responde este correo y desactivamos el IMEI desde el panel administrativo; las cuentas que ya están dentro siguen funcionando.`,
    '',
    `  → Tu panel: ${dashboardUrl}`,
    '',
    '— Sensu',
  ].join('\n');
  const html = `
    <p>Hola, ${input.recipientFirstName}.</p>
    <p>Acaba de unirse un nuevo familiar a la Angela (IMEI <strong>${input.imei}</strong>):</p>
    <p><strong>${input.newMemberName}</strong></p>
    <p>Ya tiene acceso al panel familiar — ve la ubicación, las alertas y puede coordinar igual que tú.</p>
    <p>¿No reconoces el nombre? Responde este correo y desactivamos el IMEI desde el panel administrativo; las cuentas que ya están dentro siguen funcionando.</p>
    <p><a href="${dashboardUrl}">Abrir el panel familiar</a></p>
    <p>— Sensu</p>
  `;
  try {
    await sendEmail({ to: input.to, subject, text, html });
  } catch (err) {
    console.error('sendNewMemberJoinedEmail failed (non-fatal)', err);
  }
}
