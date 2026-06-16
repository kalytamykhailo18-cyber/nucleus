/**
 * PATCH /api/auth/me — alias normalization.
 *
 * sensu-api's Pydantic schema uses Field(alias=) + populate_by_name=True so
 * that both `height` and `height_cm`, `weight` and `weight_kg`, etc. are
 * accepted on input. The mobile app and Sensu Pay each historically chose
 * different keys, and this is what stops the round-trip drop where one
 * platform writes `height` and the other reads `height_cm`.
 *
 * This module folds incoming snake_case + alias keys into the canonical
 * camelCase Prisma form before Zod validation runs.
 */
const KEY_ALIASES: Record<string, string> = {
  // snake_case → camelCase
  full_name: 'fullName',
  phone_number: 'phone',
  date_of_birth: 'dateOfBirth',
  blood_type: 'bloodType',
  height_cm: 'heightCm',
  weight_kg: 'weightKg',
  medical_conditions: 'medicalConditions',
  profile_image_url: 'profileImageUrl',
  user_phone: 'userPhone',
  // legacy short forms (mobile app used these)
  height: 'heightCm',
  weight: 'weightKg',
};

export function normalizeProfileKeys(body: unknown): Record<string, unknown> {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return {};
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    const canonical = KEY_ALIASES[k] ?? k;
    // Last-write wins on conflict (e.g. both `height` and `height_cm` present).
    out[canonical] = v;
  }
  return out;
}
