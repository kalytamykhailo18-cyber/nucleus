import { z } from 'zod';

/**
 * Validation for the shared CompanyEmergencyContact roster (Phase C #1
 * reshape, Juan 2026-06-10). Same field set as the per-user
 * EmergencyContact model so the call-center lookup can substitute one
 * for the other transparently.
 */

const trimRequired = (v: unknown): unknown =>
  typeof v === 'string' ? v.trim() : v;

const trimOptional = (v: unknown): unknown => {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') {
    const t = v.trim();
    return t.length === 0 ? null : t;
  }
  return v;
};

export const companyContactCreateSchema = z.object({
  fullName: z.preprocess(trimRequired, z.string().min(1).max(160)),
  phone: z.preprocess(trimRequired, z.string().min(7).max(40)),
  relationship: z
    .preprocess(trimOptional, z.string().min(1).max(80).nullable())
    .optional(),
  priority: z.number().int().min(0).max(99).optional(),
});

export const companyContactUpdateSchema = companyContactCreateSchema.partial();

export type CompanyContactCreateInput = z.infer<typeof companyContactCreateSchema>;
export type CompanyContactUpdateInput = z.infer<typeof companyContactUpdateSchema>;
