import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email-transport';
import { env } from '@/lib/env';
import { sensuContact } from '@/lib/contact-info';

/**
 * Device-inactive alert (Juan 2026-06-26). Fires once per Subscription
 * when the paired Angela has not reported any EviewEvent in seven full
 * days. The most common cause is a dead battery; second most common is
 * a buyer who let the device drift to the bottom of a drawer. Either
 * way the call-center cannot dispatch help on a device that is not
 * online, so this email pushes the family to plug it back in before
 * the next emergency.
 *
 * The dedup is owned by the drip tick (one DripEmailLog row per
 * subscription, kind DEVICE_INACTIVE_7D). If the device starts
 * reporting again and goes silent for another seven days later, the
 * existing log row keeps it from re-firing — a deliberately
 * conservative choice so the family is not pestered every week. A
 * follow-up beat (DEVICE_INACTIVE_30D) could come later if needed.
 */
export async function sendDeviceInactive7dEmail(
  subscriptionId: string,
): Promise<void> {
  const sub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: {
      user: {
        select: {
          email: true,
          fullName: true,
          devices: {
            select: { eviewDeviceId: true, label: true },
            take: 1,
          },
        },
      },
    },
  });
  if (!sub || !sub.user.email) return;

  const firstName = (sub.user.fullName ?? '').split(' ')[0]?.trim() || 'Hola';
  const device = sub.user.devices[0];
  const deviceLabel = device?.label ?? 'tu Angela';
  const baseUrl = env.AUTH_URL.replace(/\/$/, '');
  const dashboardUrl = `${baseUrl}/dashboard`;
  const callcenter = sensuContact.callcenter();

  const subject = `${firstName}, ${deviceLabel} no está reportando`;
  const text = [
    `Hola, ${firstName}.`,
    '',
    `Pasaron siete días sin recibir señal de ${deviceLabel}. Lo más común es que se haya quedado sin batería.`,
    '',
    'Por favor revisa tres cosas:',
    '',
    '  · ¿Está cargada? Conéctala 2 a 3 horas y mira el LED.',
    '  · ¿Quién la trae puesta? Si está olvidada, devuélvela al uso diario.',
    '  · ¿Hay señal en el lugar donde vive? La Angela necesita celular para reportar.',
    '',
    `Puedes confirmar el estado en tu panel: ${dashboardUrl}. La barra de batería se actualiza dentro de minutos una vez que vuelva a reportar.`,
    '',
    `Si crees que la Angela falló, llama al ${callcenter.display} y te orientamos en cómo cambiarla por una nueva.`,
    '',
    '— Sensu',
  ].join('\n');
  const html = `
    <p>Hola, ${firstName}.</p>
    <p>Pasaron siete días sin recibir señal de <strong>${deviceLabel}</strong>. Lo más común es que se haya quedado sin batería.</p>
    <p>Por favor revisa tres cosas:</p>
    <ul>
      <li>¿Está cargada? Conéctala 2 a 3 horas y mira el LED.</li>
      <li>¿Quién la trae puesta? Si está olvidada, devuélvela al uso diario.</li>
      <li>¿Hay señal en el lugar donde vive? La Angela necesita celular para reportar.</li>
    </ul>
    <p>Puedes confirmar el estado en tu panel: <a href="${dashboardUrl}">${dashboardUrl}</a>. La barra de batería se actualiza dentro de minutos una vez que vuelva a reportar.</p>
    <p>Si crees que la Angela falló, llama al <a href="tel:${callcenter.tel}">${callcenter.display}</a> y te orientamos en cómo cambiarla por una nueva.</p>
    <p>— Sensu</p>
  `;

  await sendEmail({ to: sub.user.email, subject, text, html });
}
