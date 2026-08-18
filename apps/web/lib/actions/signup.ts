'use server';

import { cookies } from 'next/headers';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { normalizeEmail } from '@/lib/email';
import {
  SIGNUP_SOURCE_COOKIE,
  resolveSignupSource,
  sanitizeSource,
} from '@/lib/signup-source';
import { syncContact } from '@/lib/hubspot';
import {
  findReferrerByCode,
  recordReferralAttribution,
} from '@/lib/referrals';

export interface SignupFormState {
  ok: boolean;
  error?: string;
}

const signupSchema = z.object({
  email: z.string().email('Email no válido'),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(1024),
  fullName: z.string().min(1, 'El nombre es obligatorio').max(255).optional().nullable(),
  source: z.string().max(40).optional().nullable(),
});

export async function signupAction(
  _prevState: SignupFormState,
  formData: FormData,
): Promise<SignupFormState> {
  const parsed = signupSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    fullName: formData.get('fullName') ?? null,
    source: formData.get('source') ?? null,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos no válidos' };
  }

  const email = normalizeEmail(parsed.data.email);
  if (!email) return { ok: false, error: 'Email no válido' };

  // Case-insensitive existence check; matches sensu-api email_exists().
  const existing = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "User" WHERE LOWER(email) = ${email} LIMIT 1
  `;
  if (existing.length > 0) {
    return { ok: false, error: 'Este email ya está registrado' };
  }

  const cookieStore = await cookies();
  const signupSource = await resolveSignupSource({
    cookieValue: cookieStore.get(SIGNUP_SOURCE_COOKIE)?.value ?? null,
    querySource: sanitizeSource(parsed.data.source),
    promoCode: null,
  });

  // Referral code (Phase A+ #1, 2026-06-16). Sticky cookie set by
  // middleware when the visitor first lands via `?ref=CODE`; we
  // attribute the new User to the referrer iff the code resolves
  // and isn't the new user's own (self-referrals make no sense).
  const referralCookie = cookieStore.get('nucleus_referral_code')?.value ?? null;

  let createdUserId: string | null = null;
  try {
    const created = await prisma.user.create({
      data: {
        email,
        passwordHash: hashPassword(parsed.data.password),
        fullName: parsed.data.fullName ?? null,
        isActive: true,
        questionnaireCompleted: false,
        signupSource,
      },
      select: { id: true },
    });
    createdUserId = created.id;
  } catch (err) {
    console.error('signupAction create failed', err);
    return { ok: false, error: 'No se pudo crear la cuenta. Inténtalo de nuevo.' };
  }

  if (referralCookie && createdUserId) {
    const referrer = await findReferrerByCode(referralCookie, createdUserId);
    if (referrer) {
      void recordReferralAttribution({
        referrerUserId: referrer.id,
        referredUserId: createdUserId,
        code: referralCookie,
      });
    }
  }

  void syncContact({
    email,
    fullName: parsed.data.fullName ?? null,
    phone: null,
    signupSource,
  });

  return { ok: true };
}
