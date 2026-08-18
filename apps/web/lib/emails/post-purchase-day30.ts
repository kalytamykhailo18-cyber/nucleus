import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email-transport';
import { env } from '@/lib/env';
import { sensuContact } from '@/lib/contact-info';

/**
 * Day-30 retention nudge (Juan 2026-06-26). Fires once per Subscription
 * 30 to 37 days after `activatedAt`. The buyer has had Angela a full
 * month; the second monthly charge is about to land. This email
 * pre-empts the surprise by reminding them the service is still on,
 * surfacing one stat from the past month, and offering the share-with-
 * family rail in case the buyer wants more relatives to receive the
 * alerts.
 *
 * If we cannot count any alerts (device idle, no events) the body
 * collapses to the share-rail prompt only — never lie about activity
 * the system did not actually see.
 */
export async function sendPostPurchaseDay30Email(
  subscriptionId: string,
): Promise<void> {
  const sub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: {
      activatedAt: true,
      user: {
        select: {
          id: true,
          email: true,
          fullName: true,
          devices: { select: { eviewDeviceId: true }, take: 1 },
        },
      },
    },
  });
  if (!sub || !sub.user.email || !sub.activatedAt) return;

  // Count the past 30 days of events on the user's first paired device
  // (most family accounts only own one). Used in the body if > 0.
  let alertCount = 0;
  const primaryDeviceId = sub.user.devices[0]?.eviewDeviceId;
  if (primaryDeviceId) {
    const since = new Date(sub.activatedAt);
    alertCount = await prisma.eviewEvent.count({
      where: {
        eviewDeviceId: primaryDeviceId,
        eventType: { in: ['sos', 'fall_detection', 'battery_low'] },
        timestamp: { gte: since },
      },
    });
  }

  const firstName = (sub.user.fullName ?? '').split(' ')[0]?.trim() || 'Hola';
  const baseUrl = env.AUTH_URL.replace(/\/$/, '');
  const profileUrl = `${baseUrl}/profile`;
  const callcenter = sensuContact.callcenter();

  const subject = `${firstName}, un mes con Sensu Angela`;
  const stat =
    alertCount > 0
      ? `En estos 30 días el call-center procesó ${alertCount} ${
          alertCount === 1 ? 'alerta' : 'alertas'
        } de tu Angela.`
      : 'Tu Angela estuvo tranquila este mes — sin alertas activas, que es justo lo que esperamos.';

  const text = [
    `Hola, ${firstName}.`,
    '',
    'Hoy se cumple un mes desde que activamos tu Sensu Angela.',
    '',
    stat,
    '',
    `Si quieres que algún familiar más reciba las alertas en su teléfono, comparte el código que aparece en tu perfil: ${profileUrl}. Cada familiar entra como observador con el mismo número de cliente y la contraseña corta que ahí mostramos.`,
    '',
    `Cualquier ajuste o duda, responde este correo o llama al ${callcenter.display}. El call-center está activo 24/7.`,
    '',
    '— Sensu',
  ].join('\n');
  const html = `
    <p>Hola, ${firstName}.</p>
    <p>Hoy se cumple un mes desde que activamos tu Sensu Angela.</p>
    <p>${stat}</p>
    <p>Si quieres que algún familiar más reciba las alertas en su teléfono, comparte el código que aparece en tu perfil: <a href="${profileUrl}">${profileUrl}</a>. Cada familiar entra como observador con el mismo número de cliente y la contraseña corta que ahí mostramos.</p>
    <p>Cualquier ajuste o duda, responde este correo o llama al <a href="tel:${callcenter.tel}">${callcenter.display}</a>. El call-center está activo 24/7.</p>
    <p>— Sensu</p>
  `;

  await sendEmail({ to: sub.user.email, subject, text, html });
}
