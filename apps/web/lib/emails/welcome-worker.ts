import crypto from 'node:crypto';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email-transport';
import { env } from '@/lib/env';

/**
 * Welcome email for a worker added via B2B CSV import (Step 12).
 *
 * The worker's User row is created with a random throw-away password
 * they cannot use to sign in directly; instead they receive this
 * email containing a one-time `/reset-password?token=…` link
 * (reusing the existing `PasswordReset` flow) so they pick their own
 * password before logging in via the mobile app.
 *
 * Fire-and-forget per the rest of the email transport — caller
 * `void`s this so any Resend hiccup doesn't fail the import.
 */
const TOKEN_BYTES = 32;
const RESET_TTL_MIN = 60 * 24 * 7; // 7-day window — workers may take days to react

export async function sendWelcomeWorkerEmail(args: {
  userId: string;
  email: string;
  fullName: string;
  companyName: string;
}): Promise<void> {
  const rawToken = crypto.randomBytes(TOKEN_BYTES).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + RESET_TTL_MIN * 60_000);

  await prisma.passwordReset.create({
    data: { userId: args.userId, tokenHash, expiresAt },
  });

  const baseUrl = env.AUTH_URL.replace(/\/$/, '');
  const setupUrl = `${baseUrl}/reset-password?token=${rawToken}`;
  const firstName = args.fullName.split(' ')[0]?.trim() || 'Hola';

  const subject = `Bienvenido a Sensu · ${args.companyName}`;
  const text = [
    `Hola, ${firstName}.`,
    '',
    `${args.companyName} te dio de alta en Sensu para usar tu dispositivo Angela.`,
    '',
    'Para activar tu cuenta, elige una contraseña con este enlace (válido 7 días):',
    '',
    `  → ${setupUrl}`,
    '',
    'Después podrás descargar la app móvil, iniciar sesión con este correo y la',
    'contraseña que elegiste, e ingresar el IMEI de tu dispositivo para vincularlo.',
    '',
    'Si no esperabas este correo, ignóralo y tu cuenta no se activará.',
    '',
    '— Sensu',
  ].join('\n');
  const html = `
    <p>Hola, ${firstName}.</p>
    <p><strong>${args.companyName}</strong> te dio de alta en Sensu para usar tu dispositivo Angela.</p>
    <p>Para activar tu cuenta, elige una contraseña con este enlace (válido 7 días):</p>
    <p><a href="${setupUrl}">${setupUrl}</a></p>
    <p>Después podrás descargar la app móvil, iniciar sesión con este correo y la contraseña que elegiste, e ingresar el IMEI de tu dispositivo para vincularlo.</p>
    <p>Si no esperabas este correo, ignóralo y tu cuenta no se activará.</p>
    <p>— Sensu</p>
  `;

  await sendEmail({ to: args.email, subject, text, html });
}
