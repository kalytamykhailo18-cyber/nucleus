import { sendEmail } from '@/lib/email-transport';
import { sensuContact } from '@/lib/contact-info';

/**
 * PWA install announcement email (Juan 2026-06-16). One-time blast to
 * existing customers telling them they can install Sensu on their
 * phone without going through the App Store or Google Play. Lands on
 * /instalar where the per-platform steps live.
 *
 * Phone number is read from the env-driven contact helper so a future
 * rotation doesn't need a code edit.
 */

export interface PwaAnnouncementRecipient {
  email: string;
  fullName: string | null;
}

export async function sendPwaAnnouncementEmail(
  recipient: PwaAnnouncementRecipient,
): Promise<void> {
  const firstName =
    (recipient.fullName ?? '').split(' ')[0]?.trim() || 'Hola';
  const callcenter = sensuContact.callcenter();

  const subject = 'Sensu ahora se instala en tu teléfono';

  const text = [
    `Hola ${firstName},`,
    '',
    'Sensu ahora se puede instalar como una app en la pantalla de inicio',
    'de tu iPhone o Android, sin pasar por App Store ni Google Play.',
    '',
    '¿Por qué hacerlo?',
    '',
    '  · Recibes las alertas con sonido como una app de verdad.',
    '  · Abres el panel familiar con un toque, sin escribir la dirección.',
    '  · Funciona igual de bien en iPhone y Android.',
    '',
    'Sigue los pasos aquí: https://sensu.com.mx/instalar',
    '',
    `Si necesitas ayuda, llámanos al ${callcenter.display}. El call-center`,
    'está activo 24/7.',
    '',
    'Un saludo,',
    'El equipo de Sensu',
  ].join('\n');

  const html = `
    <p>Hola ${firstName},</p>
    <p>Sensu ahora se puede instalar como una <strong>app en la pantalla de inicio</strong> de tu iPhone o Android, sin pasar por App Store ni Google Play.</p>
    <p><strong>¿Por qué hacerlo?</strong></p>
    <ul>
      <li>Recibes las alertas con sonido como una app de verdad.</li>
      <li>Abres el panel familiar con un toque, sin escribir la dirección.</li>
      <li>Funciona igual de bien en iPhone y Android.</li>
    </ul>
    <p>Sigue los pasos aquí: <a href="https://sensu.com.mx/instalar">https://sensu.com.mx/instalar</a></p>
    <p>Si necesitas ayuda, llámanos al <a href="tel:${callcenter.tel}">${callcenter.display}</a>. El call-center está activo 24/7.</p>
    <p>Un saludo,<br/>El equipo de Sensu</p>
  `;

  await sendEmail({ to: recipient.email, subject, text, html });
}
