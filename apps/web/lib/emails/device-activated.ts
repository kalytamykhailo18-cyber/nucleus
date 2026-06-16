import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email-transport';
import { env } from '@/lib/env';

/**
 * Device-activated notification — fires once when the call-center
 * pairs an Angela IMEI to the user (i.e., creates the MASTER
 * UserDevice row). Closes the onboarding loop: the family knows the
 * pendant is live, monitoring is armed, and the dashboard now shows
 * real telemetry.
 *
 * Fire-and-forget. Failure here doesn't block the device pairing.
 */
export async function sendDeviceActivatedEmail(
  subscriptionId: string,
): Promise<void> {
  const sub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: {
      activatedDeviceId: true,
      user: {
        select: {
          email: true,
          fullName: true,
          userPhone: true,
        },
      },
    },
  });
  if (!sub || !sub.user.email) return;

  const firstName = (sub.user.fullName ?? '').split(' ')[0]?.trim() || 'Hola';
  const deviceId = sub.activatedDeviceId ?? '—';
  const dashboardUrl = `${env.AUTH_URL.replace(/\/$/, '')}/dashboard`;
  const seniorPhone = sub.user.userPhone ?? null;

  const subject = 'Tu Angela ya está activa · monitoreo en vivo';
  const text = [
    `Hola, ${firstName}.`,
    '',
    `Tu Angela (IMEI ${deviceId}) quedó activa hace un momento y el call-center ya la asoció a ${firstName}.`,
    seniorPhone
      ? `Si tu familiar pide ayuda desde su celular ${seniorPhone}, identificamos la llamada al instante.`
      : '',
    '',
    'Desde este momento:',
    '',
    '  · La ubicación en vivo aparece en tu panel familiar.',
    '  · El botón SOS dispara la alerta al call-center y a tus contactos de emergencia.',
    '  · Las alertas de caída, batería baja y geocercas te llegan por notificación.',
    '',
    `  → Tu panel: ${dashboardUrl}`,
    '',
    'Si algo no se ve bien en el panel en los próximos minutos, responde este correo y lo revisamos contigo.',
    '',
    '— Sensu',
  ].filter((s) => s !== '').join('\n');
  const html = `
    <p>Hola, ${firstName}.</p>
    <p>Tu Angela (IMEI <strong>${deviceId}</strong>) quedó activa hace un momento y el call-center ya la asoció a ${firstName}.</p>
    ${seniorPhone ? `<p>Si tu familiar pide ayuda desde su celular <strong>${seniorPhone}</strong>, identificamos la llamada al instante.</p>` : ''}
    <p><strong>Desde este momento:</strong></p>
    <ul>
      <li>La ubicación en vivo aparece en tu panel familiar.</li>
      <li>El botón SOS dispara la alerta al call-center y a tus contactos de emergencia.</li>
      <li>Las alertas de caída, batería baja y geocercas te llegan por notificación.</li>
    </ul>
    <p><a href="${dashboardUrl}">Abrir el panel familiar</a></p>
    <p>Si algo no se ve bien en el panel en los próximos minutos, responde este correo y lo revisamos contigo.</p>
    <p>— Sensu</p>
  `;
  await sendEmail({ to: sub.user.email, subject, text, html });
}
