import { z } from 'zod';

/**
 * Zod schemas for the /api/admin/companies CRUD endpoints. Mirrors
 * the shape of the Company Prisma model with light normalization
 * (trim strings, drop empty optional fields to null).
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

export const companyCreateSchema = z.object({
  name: z.preprocess(trimRequired, z.string().min(2).max(255)),
  contactName: z.preprocess(trimOptional, z.string().min(1).max(255).nullable()).optional(),
  contactEmail: z
    .preprocess(trimOptional, z.string().email().nullable())
    .optional(),
  contactPhone: z
    .preprocess(trimOptional, z.string().min(1).max(40).nullable())
    .optional(),
  notes: z.preprocess(trimOptional, z.string().min(1).max(2000).nullable()).optional(),
  isActive: z.boolean().optional(),
  // Industrial-fleet rail (Phase C #1 reshape, 2026-06-10). When true,
  // workers are MANAGED_WORKER device-only rows with no login and the
  // CSV importer accepts names-only rows.
  isManagedFleet: z.boolean().optional(),
});

export const companyUpdateSchema = companyCreateSchema.partial();

export type CompanyCreateInput = z.infer<typeof companyCreateSchema>;
export type CompanyUpdateInput = z.infer<typeof companyUpdateSchema>;
