import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/admin/landing/[slug] — upsert a LandingItem override
 * for the slug. Inline EditableText / EditableImage components on `/`
 * call this when an admin saves an edit in place.
 *
 * The body's `kind` discriminator constrains the `content` shape:
 *   - TEXT  → { text: string }
 *   - IMAGE → { url: string, alt?: string | null }
 *   - VIDEO → { url: string }  (YouTube / Vimeo / Cloudinary / direct mp4)
 */

const textContentSchema = z.object({
  text: z.string().min(1).max(10_000),
});
const imageContentSchema = z.object({
  url: z.string().url(),
  alt: z.string().max(500).nullable().optional(),
});
const videoContentSchema = z.object({
  url: z.string().url(),
});

const bodySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('TEXT'), content: textContentSchema }),
  z.object({ kind: z.literal('IMAGE'), content: imageContentSchema }),
  z.object({ kind: z.literal('VIDEO'), content: videoContentSchema }),
]);

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  await requireAdmin();
  const { slug } = await ctx.params;
  if (!slugRegex.test(slug) || slug.length > 80) {
    return NextResponse.json({ error: 'invalid_slug' }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const row = await prisma.landingItem.upsert({
    where: { slug },
    create: {
      slug,
      kind: parsed.data.kind,
      content: parsed.data.content,
    },
    update: {
      kind: parsed.data.kind,
      content: parsed.data.content,
    },
    select: { id: true, slug: true, kind: true, updatedAt: true },
  });

  return NextResponse.json({
    ok: true,
    id: row.id,
    slug: row.slug,
    kind: row.kind,
    updatedAt: row.updatedAt.toISOString(),
  });
}
