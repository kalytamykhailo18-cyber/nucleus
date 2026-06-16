import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email-transport';
import { env } from '@/lib/env';

/**
 * Shipment notification — fires once when the call-center stamps
 * `shippedAt` on a Subscription. Carries the shipping address (from
 * the questionnaire) and a "what's next" pointer so the family knows
 * the Angela is on the way and the activation call is coming after
 * delivery.
 *
 * Fire-and-forget. A Resend hiccup never blocks the shipment update.
 */
export async function sendShipmentNotificationEmail(
  subscriptionId: string,
): Promise<void> {
  const sub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: {
      user: {
        select: {
          email: true,
          fullName: true,
          shippingAddress: true,
          address: true,
        },
      },
    },
  });
  if (!sub || !sub.user.email) return;

  const firstName = (sub.user.fullName ?? '').split(' ')[0]?.trim() || 'Hola';
  const shippingAddress = sub.user.shippingAddress ?? sub.user.address ?? '—';
  const dashboardUrl = `${env.AUTH_URL.replace(/\/$/, '')}/dashboard`;

  const subject = 'Tu Angela ya está en camino · Sensu';
  const text = [
    `Hola, ${firstName}.`,
    '',
    'Tu Angela acaba de salir de nuestro centro de distribución y llegará a la dirección que registraste en los próximos días hábiles:',
    '',
    `  ${shippingAddress}`,
    '',
    '¿Qué pasa cuando llega?',
    '',
    '  · Te llama el call-center para activarla a nombre de tu familiar.',
    '  · En cuanto quede en línea, aparece en tu panel familiar con su ubicación y batería.',
    '',
    'Si tienes que cambiar la dirección o coordinar una entrega especial, responde este correo y te ayudamos.',
    '',
    `  → Tu panel: ${dashboardUrl}`,
    '',
    '— Sensu',
  ].join('\n');
  const html = `
    <p>Hola, ${firstName}.</p>
    <p>Tu Angela acaba de salir de nuestro centro de distribución y llegará a la dirección que registraste en los próximos días hábiles:</p>
    <p><strong>${shippingAddress}</strong></p>
    <p><strong>¿Qué pasa cuando llega?</strong></p>
    <ul>
      <li>Te llama el call-center para activarla a nombre de tu familiar.</li>
      <li>En cuanto quede en línea, aparece en tu panel familiar con su ubicación y batería.</li>
    </ul>
    <p>Si tienes que cambiar la dirección o coordinar una entrega especial, responde este correo y te ayudamos.</p>
    <p><a href="${dashboardUrl}">Abrir el panel familiar</a></p>
    <p>— Sensu</p>
  `;
  await sendEmail({ to: sub.user.email, subject, text, html });
}
