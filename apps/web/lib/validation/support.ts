import { z } from 'zod';

const trimRequired = (v: unknown): unknown => {
  if (typeof v === 'string') return v.trim();
  return v;
};

const trimOptional = (v: unknown): unknown => {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') {
    const t = v.trim();
    return t.length === 0 ? null : t;
  }
  return v;
};

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const supportArticleCreateSchema = z.object({
  slug: z.preprocess(
    trimRequired,
    z
      .string()
      .min(2)
      .max(80)
      .regex(slugRegex, 'Slug en minúsculas, números y guiones'),
  ),
  title: z.preprocess(trimRequired, z.string().min(2).max(160)),
  body: z.preprocess(trimRequired, z.string().min(1).max(20_000)),
  videoUrl: z.preprocess(
    trimOptional,
    z.string().url('Debe ser una URL válida').nullable().optional(),
  ),
  imageUrl: z.preprocess(
    trimOptional,
    z.string().url('Debe ser una URL válida').nullable().optional(),
  ),
  iconKey: z.preprocess(
    trimOptional,
    z.string().min(1).max(40).nullable().optional(),
  ),
  priority: z.coerce.number().int().min(0).max(9_999).optional(),
  published: z.coerce.boolean().optional(),
});

export const supportArticleUpdateSchema = supportArticleCreateSchema.partial();

export type SupportArticleCreateInput = z.infer<typeof supportArticleCreateSchema>;
export type SupportArticleUpdateInput = z.infer<typeof supportArticleUpdateSchema>;
