'use server';

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { normalizeEmail } from '@/lib/email';

/**
 * "Soy familiar de un usuario Sensu" signup — per Juan 2026-05-15.
 *
 * The relative knows three things shared by the Master User:
 *  1. The device IMEI (the long number on the pendant).
 *  2. The Master's 6-digit Client ID.
 *  3. The Master's share password (8 chars).
 *
 * If the triple resolves to a Master who owns that exact device, we
 * create the User and immediately link a UserDevice row with role
 * WATCHER on that device. The relative then signs in normally and
 * sees the same /dashboard as any family member.
 */

export interface FamilySignupState {
  ok: boolean;
  error?: string;
}

const familySignupSchema = z.object({
  email: z.string().email('Email no válido'),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(1024),
  fullName: z
    .string()
    .min(1, 'El nombre es obligatorio')
    .max(255)
    .optional()
    .nullable(),
  imei: z
    .string()
    .trim()
    .min(8, 'IMEI debe tener entre 8 y 20 caracteres')
    .max(20)
    .regex(/^[A-Za-z0-9-]+$/, 'IMEI sólo admite letras, números y guiones'),
  masterClientId: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'ID de cliente debe tener 6 dígitos'),
  shareCode: z
    .string()
    .trim()
    .regex(/^[A-HJ-NP-Za-hj-np-z2-9]{8}$/, 'Contraseña para compartir no válida'),
});

export async function familySignupAction(
  _prevState: FamilySignupState,
  formData: FormData,
): Promise<FamilySignupState> {
  const parsed = familySignupSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    fullName: formData.get('fullName') ?? null,
    imei: formData.get('imei'),
    masterClientId: formData.get('masterClientId'),
    shareCode: formData.get('shareCode'),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Datos no válidos',
    };
  }
  const email = normalizeEmail(parsed.data.email);
  if (!email) return { ok: false, error: 'Email no válido' };

  // Master lookup. Share password is short-but-not-secret; if we
  // exposed which of the three identifiers was wrong, an attacker
  // could pivot to enumerate Client IDs. So the failure messages are
  // intentionally identical.
  const masterCandidate = await prisma.user.findUnique({
    where: { clientId: parsed.data.masterClientId },
    select: { id: true, shareCode: true },
  });
  if (
    !masterCandidate ||
    !masterCandidate.shareCode ||
    masterCandidate.shareCode.toUpperCase() !==
      parsed.data.shareCode.toUpperCase()
  ) {
    return {
      ok: false,
      error:
        'No encontramos un familiar con ese ID, contraseña e IMEI. Verifica los tres y vuelve a intentar.',
    };
  }
  const owns = await prisma.userDevice.findFirst({
    where: {
      userId: masterCandidate.id,
      eviewDeviceId: parsed.data.imei,
      role: 'MASTER',
    },
    select: { id: true },
  });
  if (!owns) {
    return {
      ok: false,
      error:
        'No encontramos un familiar con ese ID, contraseña e IMEI. Verifica los tres y vuelve a intentar.',
    };
  }

  // Email uniqueness — same case-insensitive check used by signupAction.
  const existing = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "User" WHERE LOWER(email) = ${email} LIMIT 1
  `;
  if (existing.length > 0) {
    return { ok: false, error: 'Este email ya está registrado' };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          passwordHash: hashPassword(parsed.data.password),
          fullName: parsed.data.fullName ?? null,
          isActive: true,
          // Watchers don't need to complete the senior questionnaire —
          // the Master already did.
          questionnaireCompleted: true,
        },
        select: { id: true },
      });
      await tx.userDevice.create({
        data: {
          userId: created.id,
          eviewDeviceId: parsed.data.imei,
          role: 'WATCHER',
        },
      });
    });
  } catch (err) {
    console.error('familySignupAction transaction failed', err);
    return { ok: false, error: 'No se pudo crear la cuenta. Inténtalo de nuevo.' };
  }

  return { ok: true };
}
