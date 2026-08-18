import { sendEmail } from '@/lib/email-transport';
import { env } from '@/lib/env';

/**
 * Referral program emails (Juan 2026-06-16 / 2026-06-17).
 *
 * Two flavors:
 *
 *   - `sendReferralRedeemedEmail` fires when a friend's subscription
 *     flips to ACTIVE and the referrer gets credit. Lands on the
 *     referrer's inbox: "your credit landed, applies on the next
 *     renewal".
 *
 *   - `sendReferralWelcomeEmail` fires at signup when a new family
 *     creates an account with a `?ref=CODE` cookie. Lands on the
 *     friend's inbox: "your discount is locked in, finish the
 *     checkout to use it".
 *
 * Both follow the rest of the email family: subject + plain-text body
 * + HTML body, swallowed errors so a transient Resend failure never
 * blocks the underlying flow (signup, webhook). The credit / friend
 * amount and the referrer code are read from the row data, never
 * hardcoded.
 */

function firstNameFromFull(full: string | null): string {
  return (full ?? '').split(' ')[0]?.trim() || 'Hola';
}

function pesos(centavos: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(centavos / 100);
}

/**
 * Referrer-side email — fires on the ACTIVE-flip of the friend's
 * subscription, alongside the in-app credit increment.
 */
export async function sendReferralRedeemedEmail(input: {
  to: string;
  referrerFullName: string | null;
  referredFullName: string | null;
  creditCentavos: number;
}): Promise<void> {
  const firstName = firstNameFromFull(input.referrerFullName);
  const friendName = input.referredFullName?.split(' ')[0]?.trim() || 'tu amigo';
  const credit = pesos(input.creditCentavos);
  const dashboardUrl = `${env.AUTH_URL.replace(/\/$/, '')}/profile/referrals`;

  const subject = `Llegó tu crédito de ${credit} por referir a ${friendName}`;
  const text = [
    `Hola, ${firstName}.`,
    '',
    `${friendName} acaba de contratar Sensu con tu código.`,
    `Acreditamos ${credit} a tu cuenta. Se descuenta automáticamente en tu próxima renovación.`,
    '',
    `Sigue compartiendo tu código desde tu panel:`,
    `  → ${dashboardUrl}`,
    '',
    '— El equipo de Sensu',
  ].join('\n');
  const html = `
    <p>Hola, ${firstName}.</p>
    <p><strong>${friendName}</strong> acaba de contratar Sensu con tu código.</p>
    <p>Acreditamos <strong>${credit}</strong> a tu cuenta. Se descuenta automáticamente en tu próxima renovación.</p>
    <p>Sigue compartiendo tu código desde tu panel: <a href="${dashboardUrl}">${dashboardUrl}</a></p>
    <p>— El equipo de Sensu</p>
  `;
  try {
    await sendEmail({ to: input.to, subject, text, html });
  } catch (err) {
    console.error('sendReferralRedeemedEmail failed (non-fatal)', err);
  }
}

/**
 * Referee-side email — fires when a brand-new family signs up with a
 * referral attribution. Confirms the discount is locked in and that
 * it applies on the first payment.
 */
export async function sendReferralWelcomeEmail(input: {
  to: string;
  referredFullName: string | null;
  referrerFullName: string | null;
  referralCodeUsed: string;
}): Promise<void> {
  const firstName = firstNameFromFull(input.referredFullName);
  const referrer = input.referrerFullName?.split(' ')[0]?.trim() || 'un familiar';
  const checkoutUrl = `${env.AUTH_URL.replace(/\/$/, '')}/checkout`;

  const subject = `Bienvenido a Sensu · te invitó ${referrer}`;
  const text = [
    `Hola, ${firstName}.`,
    '',
    `${referrer} te invitó a Sensu con el código ${input.referralCodeUsed}.`,
    'Tu descuento queda registrado en tu cuenta y se aplica cuando completes el pago.',
    '',
    `  → Continuar el registro: ${checkoutUrl}`,
    '',
    'Si tienes dudas, responde este correo. Estamos para ayudarte.',
    '',
    '— El equipo de Sensu',
  ].join('\n');
  const html = `
    <p>Hola, ${firstName}.</p>
    <p><strong>${referrer}</strong> te invitó a Sensu con el código <strong>${input.referralCodeUsed}</strong>.</p>
    <p>Tu descuento queda registrado en tu cuenta y se aplica cuando completes el pago.</p>
    <p><a href="${checkoutUrl}">Continuar el registro</a></p>
    <p>Si tienes dudas, responde este correo. Estamos para ayudarte.</p>
    <p>— El equipo de Sensu</p>
  `;
  try {
    await sendEmail({ to: input.to, subject, text, html });
  } catch (err) {
    console.error('sendReferralWelcomeEmail failed (non-fatal)', err);
  }
}
