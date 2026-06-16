import { prisma } from '@/lib/db';

/**
 * Read helpers for /soporte (public) and /admin/soporte (admin CRUD).
 *
 * Articles are short manuals — markdown body + optional embed link +
 * optional image. The admin team adds and updates them through the
 * admin UI; the public page just renders the published ones, ordered
 * by `priority` ascending and then `createdAt` descending.
 */

export interface SupportArticleRow {
  id: string;
  slug: string;
  title: string;
  body: string;
  videoUrl: string | null;
  imageUrl: string | null;
  iconKey: string;
  priority: number;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export async function fetchPublishedArticles(): Promise<SupportArticleRow[]> {
  return prisma.supportArticle.findMany({
    where: { published: true },
    orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
  });
}

export async function fetchAllArticles(): Promise<SupportArticleRow[]> {
  return prisma.supportArticle.findMany({
    orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
  });
}

export async function fetchArticleBySlug(
  slug: string,
): Promise<SupportArticleRow | null> {
  return prisma.supportArticle.findUnique({ where: { slug } });
}
