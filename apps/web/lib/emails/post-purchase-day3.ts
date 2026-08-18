import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email-transport';
import { env } from '@/lib/env';
import { sensuContact } from '@/lib/contact-info';

/**
 * Day-3 quick check-in (Juan 2026-06-26). Fires once per Subscription
 * three to five days after `activatedAt`. The buyer has had the Angela
 * a couple of nights — long enough to charge it, walk around with it,
 * try the SOS button — but not so long that friction has hardened into
 * a churn risk.
 *
 * Tone is intentionally shorter than the day-7 follow-up: a single
 * yes/no question ("is the Angela working OK?") with a reply prompt
 * straight into the call-center number, plus the contacts-roster deep
 * link so a family that hasn't filled in emergency contacts yet can
 * close that loop now while the operator board is still empty for
 * them.
 */
export async function sendPostPurchaseDay3Email(
  subscriptionId: string,
): Promise<void> {
  const sub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: {
      user: { select: { email: true, fullName: true } },
    },
  });
  if (!sub || !sub.user.email) return;

  const firstName = (sub.user.fullName ?? '').split(' ')[0]?.trim() || 'Hola';
  const baseUrl = env.AUTH_URL.replace(/\/$/, '');
  const profileUrl = `${baseUrl}/profile`;
  const callcenter = sensuContact.callcenter();

  const subject = `${firstName}, ¿cómo va Angela estos primeros días?`;
  const text = [
    `Hola, ${firstName}.`,
    '',
    'Pasaron tres días desde que recibiste tu Angela. Solo un check rápido:',
    '',
    '  · ¿La cargaste sin problema?',
    '  · ¿Probaste el botón SOS al menos una vez?',
    '  · ¿Tienes los contactos de emergencia capturados?',
    '',
    `Si todavía no llenas los contactos, hazlo aquí en dos minutos: ${profileUrl}. Es lo único que ve el call-center cuando suena una alerta — sin contactos completos no podemos avisar a la familia.`,
    '',
    `Si algo no funciona, responde este correo o llama al ${callcenter.display}. Estamos atentos 24/7.`,
    '',
    '— Sensu',
  ].join('\n');
  const html = `
    <p>Hola, ${firstName}.</p>
    <p>Pasaron tres días desde que recibiste tu Angela. Solo un check rápido:</p>
    <ul>
      <li>¿La cargaste sin problema?</li>
      <li>¿Probaste el botón SOS al menos una vez?</li>
      <li>¿Tienes los contactos de emergencia capturados?</li>
    </ul>
    <p>Si todavía no llenas los contactos, hazlo aquí en dos minutos: <a href="${profileUrl}">${profileUrl}</a>. Es lo único que ve el call-center cuando suena una alerta — sin contactos completos no podemos avisar a la familia.</p>
    <p>Si algo no funciona, responde este correo o llama al <a href="tel:${callcenter.tel}">${callcenter.display}</a>. Estamos atentos 24/7.</p>
    <p>— Sensu</p>
  `;

  await sendEmail({ to: sub.user.email, subject, text, html });
}
