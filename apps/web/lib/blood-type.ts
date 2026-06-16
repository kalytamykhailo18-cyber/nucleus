import type { BloodType } from '@prisma/client';

/**
 * Blood-type translator — mirrors sensu-api's Pydantic field_validator.
 *
 * Accepts both the canonical Prisma enum form (A_POSITIVE) and the human
 * shorthand the app and call-center commonly use (A+, A-, etc.). Returns
 * the canonical form, or null if the input is not a recognized value.
 *
 * Known incident the translator exists to prevent: sensu-api used to 500
 * on `blood_type: "O+"` because Prisma's enum wanted O_POSITIVE. The
 * translator turns that 500 into either a successful normalize-and-store,
 * or a 422 with a readable error.
 */
const HUMAN_TO_CANONICAL: Record<string, BloodType> = {
  'A+': 'A_POSITIVE',
  'A-': 'A_NEGATIVE',
  'A−': 'A_NEGATIVE', // unicode minus
  'B+': 'B_POSITIVE',
  'B-': 'B_NEGATIVE',
  'B−': 'B_NEGATIVE',
  'AB+': 'AB_POSITIVE',
  'AB-': 'AB_NEGATIVE',
  'AB−': 'AB_NEGATIVE',
  'O+': 'O_POSITIVE',
  'O-': 'O_NEGATIVE',
  'O−': 'O_NEGATIVE',
  UNKNOWN: 'UNKNOWN',
};

const CANONICAL_VALUES: ReadonlySet<BloodType> = new Set([
  'A_POSITIVE',
  'A_NEGATIVE',
  'B_POSITIVE',
  'B_NEGATIVE',
  'AB_POSITIVE',
  'AB_NEGATIVE',
  'O_POSITIVE',
  'O_NEGATIVE',
  'UNKNOWN',
]);

export function translateBloodType(input: unknown): BloodType | null {
  if (typeof input !== 'string') return null;
  const upper = input.trim().toUpperCase();
  if (CANONICAL_VALUES.has(upper as BloodType)) return upper as BloodType;
  return HUMAN_TO_CANONICAL[upper] ?? null;
}

/** For UI dropdowns: ordered list of human labels paired with canonical values. */
export const BLOOD_TYPE_OPTIONS: ReadonlyArray<{ label: string; value: BloodType }> = [
  { label: 'A+', value: 'A_POSITIVE' },
  { label: 'A−', value: 'A_NEGATIVE' },
  { label: 'B+', value: 'B_POSITIVE' },
  { label: 'B−', value: 'B_NEGATIVE' },
  { label: 'AB+', value: 'AB_POSITIVE' },
  { label: 'AB−', value: 'AB_NEGATIVE' },
  { label: 'O+', value: 'O_POSITIVE' },
  { label: 'O−', value: 'O_NEGATIVE' },
  { label: 'No la sé', value: 'UNKNOWN' },
];
