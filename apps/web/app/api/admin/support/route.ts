import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/admin';
import { supportArticleCreateSchema } from '@/lib/validation/support';

export async function POST(req: Request): Promise<NextResponse> {
  await requireAdmin();
  const body = await req.json().catch(() => null);
  const parsed = supportArticleCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const data = parsed.data;
  try {
    const created = await prisma.supportArticle.create({
      data: {
        slug: data.slug,
        title: data.title,
        body: data.body,
        videoUrl: data.videoUrl ?? null,
        imageUrl: data.imageUrl ?? null,
        iconKey: data.iconKey ?? 'book-open',
        priority: data.priority ?? 0,
        published: data.published ?? true,
      },
    });
    return NextResponse.json({ article: created }, { status: 201 });
  } catch (err) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: string }).code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'slug_exists' },
        { status: 409 },
      );
    }
    throw err;
  }
}
