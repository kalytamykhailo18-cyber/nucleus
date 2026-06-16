import { z } from 'zod';
import { translateBloodType } from '@/lib/blood-type';

const trimOptional = (v: unknown) => {
  // Critical: preserve `undefined` so PATCH bodies that omit a field
  // don't end up writing `null` to it. The previous version mapped
  // undefined → null, which silently wiped every preprocessed column
  // on every save because zod's `.optional()` still ran the
  // preprocessor for missing keys.
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v === 'string') {
    const trimmed = v.trim();
    return trimmed.length === 0 ? null : trimmed;
  }
  return v;
};

/**
 * PATCH body schema. Every field is optional — clients may PATCH any subset.
 * Aliases (height/height_cm, etc.) are normalized to the canonical key in
 * lib/profile-aliases.ts before this schema runs, so it only sees camelCase.
 *
 * Blood type goes through translateBloodType() which accepts both canonical
 * (A_POSITIVE) and human (A+) forms; rejection here surfaces as a 422.
 */
export const profilePatchSchema = z.object({
  fullName: z.preprocess(trimOptional, z.string().min(1).max(255).nullable().optional()),
  phone: z.preprocess(trimOptional, z.string().min(3).max(40).nullable().optional()),
  // Accept YYYY-MM-DD from the date input and hand Prisma the Date it
  // wants (the column is DateTime, so a bare date string is rejected
  // with "Expected ISO-8601 DateTime").
  dateOfBirth: z.preprocess(
    trimOptional,
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato esperado: YYYY-MM-DD')
      .transform((s) => new Date(`${s}T00:00:00.000Z`))
      .nullable()
      .optional(),
  ),
  heightCm: z.coerce
    .number()
    .int()
    .positive()
    .max(300)
    .nullable()
    .optional(),
  weightKg: z.coerce
    .number()
    .positive()
    .max(500)
    .nullable()
    .optional(),
  bloodType: z
    .preprocess(
      (v) => {
        if (v === null || v === undefined) return null;
        if (typeof v !== 'string') return v;
        const t = translateBloodType(v);
        // Throw a custom message that Zod surfaces as a 422-friendly error.
        if (t === null) return 'INVALID_SENTINEL';
        return t;
      },
      z
        .enum([
          'A_POSITIVE',
          'A_NEGATIVE',
          'B_POSITIVE',
          'B_NEGATIVE',
          'AB_POSITIVE',
          'AB_NEGATIVE',
          'O_POSITIVE',
          'O_NEGATIVE',
          'UNKNOWN',
        ])
        .nullable(),
    )
    .optional(),
  medicalConditions: z.preprocess(
    trimOptional,
    z.string().max(2000).nullable().optional(),
  ),
  // Questionnaire-collected fields the family can edit later. Mirrors the
  // shape of `/api/onboarding/questionnaire` so the User row stays the
  // single source of truth for senior data.
  curp: z.preprocess(
    (v) => {
      if (v === null || v === undefined) return null;
      if (typeof v !== 'string') return v;
      const t = v.trim().toUpperCase();
      return t.length === 0 ? null : t;
    },
    z
      .string()
      .regex(/^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/, 'CURP inválida')
      .nullable()
      .optional(),
  ),
  userPhone: z.preprocess(
    trimOptional,
    z.string().max(40).nullable().optional(),
  ),
  gender: z.enum(['MUJER', 'HOMBRE', 'OTRO']).nullable().optional(),
  address: z.preprocess(
    trimOptional,
    z.string().min(1).max(500).nullable().optional(),
  ),
  housingType: z
    .enum(['CASA', 'DEPARTAMENTO', 'CONDOMINIO'])
    .nullable()
    .optional(),
  livesAlone: z.boolean().nullable().optional(),
  insuranceInfo: z.preprocess(
    trimOptional,
    z.string().max(500).nullable().optional(),
  ),
  checkInEnabled: z.boolean().optional(),
  checkInDay: z
    .enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'])
    .nullable()
    .optional(),
  checkInTimeOfDay: z.enum(['MORNING', 'EVENING']).nullable().optional(),
  // Avatar — only https:// URLs (the Cloudinary secure_url returned
  // by /api/profile/avatar). The DB column stores a link, never the
  // image bytes, so the User row stays small regardless of source
  // file size.
  profileImageUrl: z.preprocess(
    trimOptional,
    z
      .string()
      .url()
      .startsWith('https://', 'Debe ser una URL HTTPS')
      .max(1024)
      .nullable()
      .optional(),
  ),
});

export type ProfilePatchInput = z.infer<typeof profilePatchSchema>;
