import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/admin';
import { supportArticleUpdateSchema } from '@/lib/validation/support';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  await requireAdmin();
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = supportArticleUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }
  const data = parsed.data;
  try {
    const updated = await prisma.supportArticle.update({
      where: { id },
      data: {
        ...(data.slug !== undefined ? { slug: data.slug } : {}),
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.body !== undefined ? { body: data.body } : {}),
        ...(data.videoUrl !== undefined ? { videoUrl: data.videoUrl } : {}),
        ...(data.imageUrl !== undefined ? { imageUrl: data.imageUrl } : {}),
        ...(data.iconKey !== undefined ? { iconKey: data.iconKey ?? 'book-open' } : {}),
        ...(data.priority !== undefined ? { priority: data.priority } : {}),
        ...(data.published !== undefined ? { published: data.published } : {}),
      },
    });
    return NextResponse.json({ article: updated });
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err) {
      const code = (err as { code: string }).code;
      if (code === 'P2002') {
        return NextResponse.json(
          { error: 'slug_exists' },
          { status: 409 },
        );
      }
      if (code === 'P2025') {
        return NextResponse.json({ error: 'not_found' }, { status: 404 });
      }
    }
    throw err;
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  await requireAdmin();
  const { id } = await params;
  try {
    await prisma.supportArticle.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: string }).code === 'P2025'
    ) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    throw err;
  }
}
