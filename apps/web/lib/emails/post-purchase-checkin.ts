import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email-transport';
import { env } from '@/lib/env';
import { sensuContact } from '@/lib/contact-info';

/**
 * Post-purchase check-in — fires once per Subscription on day 7-8
 * after `activatedAt` (the moment the call-center paired the IMEI to
 * the user). The buyer has had a week with the Angela; this email
 * surfaces the most-likely friction points (battery, button, app
 * pairing) with deep links into /soporte and an invitation to reply.
 *
 * The cron tick filters by `activatedAt` not `startDate` because the
 * service only really starts the day the device is in hand and paired
 * — anything earlier and the buyer has nothing to feed back on yet.
 */
export async function sendPostPurchaseCheckinEmail(
  subscriptionId: string,
): Promise<void> {
  const sub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: {
      user: { select: { email: true, fullName: true } },
      plan: { select: { name: true } },
    },
  });
  if (!sub || !sub.user.email) return;

  const firstName = (sub.user.fullName ?? '').split(' ')[0]?.trim() || 'Hola';
  const baseUrl = env.AUTH_URL.replace(/\/$/, '');
  const supportUrl = `${baseUrl}/soporte`;
  const dashboardUrl = `${baseUrl}/dashboard`;
  const callcenter = sensuContact.callcenter();

  const subject = `${firstName}, ¿cómo va la primera semana con Angela?`;
  const text = [
    `Hola, ${firstName}.`,
    '',
    'Ya cumpliste una semana con Sensu Angela. Queríamos saber cómo está yendo.',
    '',
    'Las preguntas que más nos hacen en los primeros días:',
    '  · Cómo cargar el dispositivo y qué significa cada LED',
    '  · Cómo funciona el botón SOS y qué pasa cuando se presiona',
    '  · Cómo leer el mapa en la app y configurar geocercas',
    '',
    `Las respuestas viven aquí: ${supportUrl}`,
    `Tu panel familiar (alertas, ubicación, ajustes): ${dashboardUrl}`,
    '',
    `Si algo no está funcionando, responde este correo o llámanos sin costo al ${callcenter.display} — el call-center está activo 24/7.`,
    '',
    '— Sensu',
  ].join('\n');
  const html = `
    <p>Hola, ${firstName}.</p>
    <p>Ya cumpliste una semana con <strong>Sensu Angela</strong>. Queríamos saber cómo está yendo.</p>
    <p>Las preguntas que más nos hacen en los primeros días:</p>
    <ul>
      <li>Cómo cargar el dispositivo y qué significa cada LED</li>
      <li>Cómo funciona el botón SOS y qué pasa cuando se presiona</li>
      <li>Cómo leer el mapa en la app y configurar geocercas</li>
    </ul>
    <p>Las respuestas viven aquí: <a href="${supportUrl}">${supportUrl}</a></p>
    <p>Tu panel familiar (alertas, ubicación, ajustes): <a href="${dashboardUrl}">${dashboardUrl}</a></p>
    <p>Si algo no está funcionando, responde este correo o llámanos sin costo al <a href="tel:${callcenter.tel}">${callcenter.display}</a> — el call-center está activo 24/7.</p>
    <p>— Sensu</p>
  `;

  await sendEmail({ to: sub.user.email, subject, text, html });
}
