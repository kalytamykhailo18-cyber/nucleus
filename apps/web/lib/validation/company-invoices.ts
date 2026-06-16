import { z } from 'zod';

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

/** Coerce a YYYY-MM-DD or ISO string to a Date; null on blank. */
const isoDateOptional = z.preprocess((v) => {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return v;
  if (typeof v === 'string') {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return v;
}, z.date().nullable());

export const companyInvoiceCreateSchema = z.object({
  label: z.preprocess(trimRequired, z.string().min(2).max(255)),
  grossCentavos: z.number().int().min(0).max(1_000_000_000),
  status: z.enum(['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'VOID']).optional(),
  dueAt: isoDateOptional.optional(),
  sentAt: isoDateOptional.optional(),
  paidAt: isoDateOptional.optional(),
  paymentReference: z
    .preprocess(trimOptional, z.string().min(1).max(255).nullable())
    .optional(),
  notes: z.preprocess(trimOptional, z.string().min(1).max(2000).nullable()).optional(),
});

export const companyInvoiceUpdateSchema = companyInvoiceCreateSchema.partial();

export type CompanyInvoiceCreateInput = z.infer<typeof companyInvoiceCreateSchema>;
export type CompanyInvoiceUpdateInput = z.infer<typeof companyInvoiceUpdateSchema>;
