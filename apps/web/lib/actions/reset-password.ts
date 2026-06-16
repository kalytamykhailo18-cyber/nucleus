'use server';

import crypto from 'node:crypto';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/password';

export interface ResetPasswordState {
  ok: boolean;
  error?: string;
}

const schema = z.object({
  token: z.string().min(20).max(256),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(1024),
});

export async function resetPasswordAction(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const parsed = schema.safeParse({
    token: formData.get('token'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos no válidos' };
  }

  const tokenHash = crypto
    .createHash('sha256')
    .update(parsed.data.token)
    .digest('hex');

  const reset = await prisma.passwordReset.findUnique({
    where: { tokenHash },
  });

  if (!reset) {
    return { ok: false, error: 'Enlace inválido o ya utilizado' };
  }
  if (reset.consumedAt) {
    return { ok: false, error: 'Este enlace ya fue utilizado' };
  }
  if (reset.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: 'El enlace ha caducado. Solicita uno nuevo.' };
  }

  // Atomic: rotate the password and burn the token in one transaction.
  await prisma.$transaction([
    prisma.user.update({
      where: { id: reset.userId },
      data: { passwordHash: hashPassword(parsed.data.password) },
    }),
    prisma.passwordReset.update({
      where: { id: reset.id },
      data: { consumedAt: new Date() },
    }),
  ]);

  return { ok: true };
}
