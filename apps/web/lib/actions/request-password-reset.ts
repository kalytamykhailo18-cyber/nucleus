'use server';

import crypto from 'node:crypto';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { normalizeEmail } from '@/lib/email';
import { sendEmail } from '@/lib/email-transport';
import { env } from '@/lib/env';

export interface RequestResetState {
  ok: boolean;
  error?: string;
}

const schema = z.object({
  email: z.string().email().min(3).max(255),
});

const TOKEN_BYTES = 32; // 256 bits — security constant, must match across envs
const RESET_TTL_MIN = 60;

export async function requestPasswordResetAction(
  _prev: RequestResetState,
  formData: FormData,
): Promise<RequestResetState> {
  const parsed = schema.safeParse({ email: formData.get('email') });
  if (!parsed.success) {
    return { ok: false, error: 'Email no válido' };
  }
  const email = normalizeEmail(parsed.data.email);
  if (!email) return { ok: false, error: 'Email no válido' };

  // Always return ok:true to avoid leaking which addresses are registered.
  // (User enumeration via the request-reset endpoint is the classic bug
  // we explicitly avoid here.)
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "User" WHERE LOWER(email) = ${email} LIMIT 1
  `;
  const user = rows[0];
  if (!user) return { ok: true };

  const rawToken = crypto.randomBytes(TOKEN_BYTES).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + RESET_TTL_MIN * 60_000);

  await prisma.passwordReset.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });

  const url = `${env.AUTH_URL}/reset-password?token=${rawToken}`;
  await sendEmail({
    to: email,
    subject: 'Recuperar tu contraseña — Sensu',
    text: [
      'Hola,',
      '',
      'Recibimos una solicitud para cambiar la contraseña de tu cuenta.',
      `Abre el siguiente enlace para elegir una nueva. Caduca en ${RESET_TTL_MIN} minutos:`,
      '',
      url,
      '',
      'Si no fuiste tú, ignora este mensaje. Tu cuenta sigue protegida.',
      '',
      '— Sensu',
    ].join('\n'),
  });

  return { ok: true };
}
