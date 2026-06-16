import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';

/**
 * Idempotent seed seam for SupportArticle rows. Upserts on `slug`. Used
 * by scripts/seed-e2e.sh to plant the seven canonical sections so the
 * /soporte page is usable on day one of the demo without any admin
 * having to click through the CRUD UI first.
 *
 * Gated by E2E_HOOKS_SECRET like every other /api/dev seam.
 */
export const dynamic = 'force-dynamic';

const schema = z.object({
  slug: z.string().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(2).max(160),
  body: z.string().min(1).max(20_000),
  videoUrl: z.string().url().nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  iconKey: z.string().min(1).max(40).optional(),
  priority: z.number().int().min(0).max(9_999).optional(),
  published: z.boolean().optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = env.E2E_HOOKS_SECRET;
  if (!secret) return new NextResponse('not found', { status: 404 });
  const provided = request.headers.get('x-e2e-hook-secret');
  if (provided !== secret) return new NextResponse('not found', { status: 404 });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', message: parsed.error.issues[0]?.message ?? 'Invalid' },
      { status: 422 },
    );
  }
  const data = parsed.data;

  // One-shot seeding: if a SeedMark exists for this slug, the fixture
  // has already been planted at some point. Skip — admin owns the row
  // (or owns the decision to have deleted it). Juan 2026-06-05:
  // "as admin i have tried to delete some of the default ayuda boxes,
  // but they keep appearing back after a while".
  const markKey = `support:${data.slug}`;
  const mark = await prisma.seedMark.findUnique({ where: { key: markKey } });
  if (mark) {
    const existing = await prisma.supportArticle.findUnique({
      where: { slug: data.slug },
    });
    return NextResponse.json({
      ok: true,
      skipped: true,
      id: existing?.id ?? null,
      slug: data.slug,
    });
  }

  // First-ever seed for this slug — plant it and drop the tombstone in
  // the same transaction so future runs short-circuit.
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.supportArticle.upsert({
      where: { slug: data.slug },
      create: {
        slug: data.slug,
        title: data.title,
        body: data.body,
        videoUrl: data.videoUrl ?? null,
        imageUrl: data.imageUrl ?? null,
        iconKey: data.iconKey ?? 'book-open',
        priority: data.priority ?? 0,
        published: data.published ?? true,
      },
      update: {
        title: data.title,
        body: data.body,
        videoUrl: data.videoUrl ?? null,
        imageUrl: data.imageUrl ?? null,
        iconKey: data.iconKey ?? 'book-open',
        priority: data.priority ?? 0,
        published: data.published ?? true,
      },
    });
    await tx.seedMark.create({ data: { key: markKey } });
    return row;
  });

  return NextResponse.json({ ok: true, id: created.id, slug: created.slug });
}
