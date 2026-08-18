import crypto from 'node:crypto';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email-transport';
import { env } from '@/lib/env';

/**
 * Welcome email for a demo lead created via /admin/registrations'
 * Crear demo button (Juan 2026-06-23).
 *
 * The demo User row is minted without a passwordHash. This email
 * carries a one-time `/reset-password?token=…` link (reusing the
 * existing PasswordReset table) so the lead picks their own password,
 * then logs in. The /dashboard server component auto-bounces ACTIVE +
 * !questionnaireCompleted users into /onboarding/questionnaire, so
 * the lead lands on the medical questionnaire without us linking
 * there explicitly.
 *
 * Fire-and-forget — caller `void`s this so a Resend hiccup doesn't
 * fail the demo-create request.
 */
const TOKEN_BYTES = 32;
const RESET_TTL_MIN = 60 * 24 * 14; // 14-day window for demo follow-up

export async function sendWelcomeDemoEmail(args: {
  userId: string;
  email: string;
  fullName: string;
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

  const subject = 'Bienvenido a Sensu · activa tu cuenta de demostración';
  const text = [
    `Hola, ${firstName}.`,
    '',
    'El equipo de Sensu te abrió una cuenta de demostración para que conozcas',
    'la app y el dispositivo Angela sin cobro.',
    '',
    'Para entrar, elige una contraseña con este enlace (válido 14 días):',
    '',
    `  → ${setupUrl}`,
    '',
    'Después de elegir tu contraseña te pediremos los datos del adulto mayor',
    '(nombre, fecha de nacimiento, domicilio y contactos de emergencia) para',
    'que el call-center pueda atender una alerta en cualquier momento.',
    '',
    'Si no esperabas este correo, ignóralo y tu cuenta no se activará.',
    '',
    '— Sensu',
  ].join('\n');
  const html = `
    <p>Hola, ${firstName}.</p>
    <p>El equipo de <strong>Sensu</strong> te abrió una cuenta de demostración para que conozcas la app y el dispositivo Angela sin cobro.</p>
    <p>Para entrar, elige una contraseña con este enlace (válido 14 días):</p>
    <p><a href="${setupUrl}">${setupUrl}</a></p>
    <p>Después de elegir tu contraseña te pediremos los datos del adulto mayor (nombre, fecha de nacimiento, domicilio y contactos de emergencia) para que el call-center pueda atender una alerta en cualquier momento.</p>
    <p>Si no esperabas este correo, ignóralo y tu cuenta no se activará.</p>
    <p>— Sensu</p>
  `;

  await sendEmail({ to: args.email, subject, text, html });
}
