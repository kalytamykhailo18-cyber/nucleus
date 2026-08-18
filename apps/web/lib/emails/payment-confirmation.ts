import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email-transport';
import { env } from '@/lib/env';
import {
  cadenceLabel,
  formatAmountMXN,
  grossCentsForNet,
  isFreeShippingActive,
  ivaCentsForNet,
  SHIPPING_NET_CENTAVOS,
  type BillingCadence,
} from '@/lib/plans';

/**
 * Payment confirmation email — fires once per Subscription when it
 * flips PENDING_PAYMENT → ACTIVE. Carries the order summary the buyer
 * needs as a paper trail and a one-click link back to the
 * questionnaire so they finish onboarding.
 *
 * Two shapes:
 *   - Cadence-aware (post 2026-05-26 pricing pivot) — itemizes the
 *     one-time Dispositivo + Activación, the recurring Servicio at the
 *     chosen cadence, the IVA, the gross Total cobrado hoy, and the
 *     recurring charge from the second cycle onward.
 *   - Legacy single-monthly — kept as a fallback for subscriptions
 *     created before the pivot (cadence is null on the row).
 *
 * Fire-and-forget: callers `void` this so a Resend hiccup never blocks
 * the activation path. If the email send fails the Subscription is
 * still ACTIVE and the user lands on /onboarding/questionnaire from
 * the client redirect.
 */
export async function sendPaymentConfirmationEmail(
  subscriptionId: string,
): Promise<void> {
  const sub = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: {
      amountPaidCentavos: true,
      cadence: true,
      initialFeePaidCentavos: true,
      user: { select: { email: true, fullName: true } },
      plan: {
        select: {
          name: true,
          monitoringPrice: true,
          initialFeeCents: true,
          priceMonthlyCents: true,
          priceSemestralCents: true,
          priceAnnualCents: true,
        },
      },
    },
  });
  if (!sub || !sub.user.email) return;
  if (sub.amountPaidCentavos === null) return;

  const firstName = (sub.user.fullName ?? '').split(' ')[0]?.trim() || 'Hola';
  const dashboardUrl = `${env.AUTH_URL.replace(/\/$/, '')}/onboarding/questionnaire`;
  const installUrl = `${env.AUTH_URL.replace(/\/$/, '')}/instalar`;

  const cadence = sub.cadence as BillingCadence | null;
  const payload =
    cadence && sub.plan.initialFeeCents !== null
      ? buildCadencePayload({
          firstName,
          planName: sub.plan.name,
          cadence,
          initialFeeNet: sub.plan.initialFeeCents,
          recurringNet:
            cadence === 'MONTHLY'
              ? (sub.plan.priceMonthlyCents ?? 0)
              : cadence === 'SEMESTRAL'
                ? (sub.plan.priceSemestralCents ?? 0)
                : (sub.plan.priceAnnualCents ?? 0),
          total: sub.amountPaidCentavos,
          dashboardUrl,
          installUrl,
        })
      : buildLegacyPayload({
          firstName,
          planName: sub.plan.name,
          net: sub.plan.monitoringPrice,
          total: sub.amountPaidCentavos,
          dashboardUrl,
          installUrl,
        });

  await sendEmail({
    to: sub.user.email,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
  });
}

interface Payload {
  subject: string;
  text: string;
  html: string;
}

function buildCadencePayload(args: {
  firstName: string;
  planName: string;
  cadence: BillingCadence;
  initialFeeNet: number;
  recurringNet: number;
  total: number;
  dashboardUrl: string;
  installUrl: string;
}): Payload {
  const { firstName, planName, cadence, initialFeeNet, recurringNet, total, dashboardUrl, installUrl } = args;
  // Activación celular used to render as its own line at
  // `initialFeeNet - DEVICE_NET_CENTAVOS`. Juan 2026-06-19: drop the
  // row entirely and roll its cents into the Dispositivo Angela line.
  // The total is unchanged because both lines came out of the same
  // `initialFeeNet` slice.
  //
  // Juan 2026-07-20: when Sensu absorbs shipping (the default now via
  // NUCLEUS_FREE_SHIPPING_UNTIL_ISO), the Envío line is dropped from
  // the email breakdown to match what /checkout renders. Mirror kept in
  // apps/web/app/checkout/checkout-form.tsx.
  const shippingActuallyCharged = !isFreeShippingActive(
    Date.now(),
    env.NUCLEUS_FREE_SHIPPING_UNTIL_ISO,
  )
    ? SHIPPING_NET_CENTAVOS
    : 0;
  const subtotalNet = initialFeeNet + shippingActuallyCharged + recurringNet;
  const ivaCents = ivaCentsForNet(subtotalNet);
  const recurringGross = grossCentsForNet(recurringNet);
  const cycleNoun =
    cadence === 'MONTHLY' ? 'mes' : cadence === 'SEMESTRAL' ? 'semestre' : 'año';
  const cycleLabel = cadenceLabel(cadence);

  const shippingTextLine =
    shippingActuallyCharged > 0
      ? `    · Envío: ${formatAmountMXN(shippingActuallyCharged)}`
      : null;
  const shippingHtmlLine =
    shippingActuallyCharged > 0
      ? `<li>Envío: ${formatAmountMXN(shippingActuallyCharged)}</li>`
      : '';

  const subject = `¡Pago confirmado! · ${planName}`;
  const text = [
    `Hola, ${firstName}.`,
    '',
    `Tu pago de ${formatAmountMXN(total)} quedó confirmado. ¡Gracias por elegir Sensu!`,
    '',
    'Resumen:',
    `  · Plan: ${planName}`,
    '  Pago único hoy:',
    `    · Dispositivo Angela: ${formatAmountMXN(initialFeeNet)}`,
    ...(shippingTextLine ? [shippingTextLine] : []),
    `  · Servicio ${cycleLabel}: ${formatAmountMXN(recurringNet)}`,
    `  · IVA (16%): ${formatAmountMXN(ivaCents)}`,
    `  · Total cobrado hoy: ${formatAmountMXN(total)}`,
    `  · Pago desde el ${cycleNoun} 2 en adelante: ${formatAmountMXN(recurringGross)} (IVA incluido)`,
    '',
    'Falta un paso para activar el servicio: completa el cuestionario con los datos del usuario de la Angela.',
    '',
    `  → ${dashboardUrl}`,
    '',
    'Y algo importante desde el teléfono: instala la app de Sensu en tu pantalla de inicio para recibir las alertas con sonido cuando el pendant dispara un SOS.',
    '',
    `  → ${installUrl}`,
    '',
    'En cuanto recibamos los datos, agendamos la entrega y el call-center toma el relevo. Si tienes dudas, responde este correo.',
    '',
    '— Sensu',
  ].join('\n');
  const html = `
    <p>Hola, ${firstName}.</p>
    <p>Tu pago de <strong>${formatAmountMXN(total)}</strong> quedó confirmado. ¡Gracias por elegir Sensu!</p>
    <p><strong>Resumen:</strong></p>
    <ul>
      <li>Plan: ${planName}</li>
      <li>
        Pago único hoy:
        <ul>
          <li>Dispositivo Angela: ${formatAmountMXN(initialFeeNet)}</li>
          ${shippingHtmlLine}
        </ul>
      </li>
      <li>Servicio ${cycleLabel}: ${formatAmountMXN(recurringNet)}</li>
      <li>IVA (16%): ${formatAmountMXN(ivaCents)}</li>
      <li><strong>Total cobrado hoy: ${formatAmountMXN(total)}</strong></li>
      <li>Pago desde el ${cycleNoun} 2 en adelante: <strong>${formatAmountMXN(recurringGross)}</strong> (IVA incluido)</li>
    </ul>
    <p>Falta un paso para activar el servicio: completa el cuestionario con los datos del usuario de la Angela.</p>
    <p><a href="${dashboardUrl}">${dashboardUrl}</a></p>
    <p style="margin-top:20px;padding:16px;border-radius:12px;background:#fff1f2;border:1px solid #fecdd3;">
      <strong>Y algo importante desde el teléfono:</strong> instala la app de Sensu en tu pantalla de inicio para recibir las alertas con sonido cuando el pendant dispara un SOS.<br/>
      <a href="${installUrl}" style="display:inline-block;margin-top:10px;padding:10px 18px;border-radius:999px;background:#ff5757;color:#ffffff;font-weight:500;text-decoration:none;">Cómo instalar la app</a>
    </p>
    <p>En cuanto recibamos los datos, agendamos la entrega y el call-center toma el relevo. Si tienes dudas, responde este correo.</p>
    <p>— Sensu</p>
  `;
  return { subject, text, html };
}

function buildLegacyPayload(args: {
  firstName: string;
  planName: string;
  net: number;
  total: number;
  dashboardUrl: string;
  installUrl: string;
}): Payload {
  const { firstName, planName, net, total, dashboardUrl, installUrl } = args;
  const iva = ivaCentsForNet(net);
  const subject = '¡Pago confirmado! · Sensu Angela';
  const text = [
    `Hola, ${firstName}.`,
    '',
    `Tu pago de ${formatAmountMXN(total)} quedó confirmado. ¡Gracias por elegir Sensu!`,
    '',
    'Resumen:',
    `  · Plan: ${planName}`,
    `  · Monitoreo + Conexión + App: ${formatAmountMXN(net)}`,
    `  · IVA (16%): ${formatAmountMXN(iva)}`,
    `  · Total cobrado hoy: ${formatAmountMXN(total)}`,
    `  · Dispositivo Angela: incluido sin costo`,
    '',
    'Falta un paso para activar el servicio: completa el cuestionario con los datos del usuario de la Angela.',
    '',
    `  → ${dashboardUrl}`,
    '',
    'Y algo importante desde el teléfono: instala la app de Sensu en tu pantalla de inicio para recibir las alertas con sonido cuando el pendant dispara un SOS.',
    '',
    `  → ${installUrl}`,
    '',
    'En cuanto recibamos los datos, agendamos la entrega y el call-center toma el relevo. Si tienes dudas, responde este correo.',
    '',
    '— Sensu',
  ].join('\n');
  const html = `
    <p>Hola, ${firstName}.</p>
    <p>Tu pago de <strong>${formatAmountMXN(total)}</strong> quedó confirmado. ¡Gracias por elegir Sensu!</p>
    <p><strong>Resumen:</strong></p>
    <ul>
      <li>Plan: ${planName}</li>
      <li>Monitoreo + Conexión + App: ${formatAmountMXN(net)}</li>
      <li>IVA (16%): ${formatAmountMXN(iva)}</li>
      <li><strong>Total cobrado hoy: ${formatAmountMXN(total)}</strong></li>
      <li>Dispositivo Angela: incluido sin costo</li>
    </ul>
    <p>Falta un paso para activar el servicio: completa el cuestionario con los datos del usuario de la Angela.</p>
    <p><a href="${dashboardUrl}">${dashboardUrl}</a></p>
    <p style="margin-top:20px;padding:16px;border-radius:12px;background:#fff1f2;border:1px solid #fecdd3;">
      <strong>Y algo importante desde el teléfono:</strong> instala la app de Sensu en tu pantalla de inicio para recibir las alertas con sonido cuando el pendant dispara un SOS.<br/>
      <a href="${installUrl}" style="display:inline-block;margin-top:10px;padding:10px 18px;border-radius:999px;background:#ff5757;color:#ffffff;font-weight:500;text-decoration:none;">Cómo instalar la app</a>
    </p>
    <p>En cuanto recibamos los datos, agendamos la entrega y el call-center toma el relevo. Si tienes dudas, responde este correo.</p>
    <p>— Sensu</p>
  `;
  return { subject, text, html };
}
