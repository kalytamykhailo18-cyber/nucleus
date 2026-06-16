'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LuPencil, LuPlus, LuTrash2 } from 'react-icons/lu';
import { ConfirmModal } from '@/components/confirm-modal';
import { MediaLightbox } from '@/components/media-lightbox';
import {
  SupportIcon,
  getSupportIconCircleClasses,
} from '@/components/support-icon';
import type { SupportArticleRow } from '@/lib/support';
import {
  SoporteArticleEditModal,
  type SoporteArticleDraft,
} from './soporte-article-edit-modal';

/**
 * Inline-editable /soporte. Admins get ONE pencil per article that
 * opens a focused modal with every field (title, body, slug, icon,
 * image, video URL, priority, published) — same UX pattern as the
 * landing CMS. Plus a "Nueva guía" button at the bottom and a trash
 * icon per card. The legacy /admin/soporte route is retired.
 */
export function SoporteClient({
  initialArticles,
  isAdmin,
}: {
  initialArticles: SupportArticleRow[];
  isAdmin: boolean;
}): React.ReactElement {
  const router = useRouter();
  const [articles, setArticles] = useState<SupportArticleRow[]>(initialArticles);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<SupportArticleRow | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const editingArticle =
    editingId ? articles.find((a) => a.id === editingId) ?? null : null;

  const patchArticle = async (
    id: string,
    draft: SoporteArticleDraft,
  ): Promise<{ ok: boolean; error?: string }> => {
    const res = await fetch(`/api/admin/support/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: draft.title,
        body: draft.body,
        slug: draft.slug,
        iconKey: draft.iconKey,
        imageUrl: draft.imageUrl || null,
        videoUrl: draft.videoUrl || null,
        priority: draft.priority,
        published: draft.published,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        ok: false,
        error: data.error === 'slug_exists' ? 'Ese slug ya existe.' : 'No pudimos guardar.',
      };
    }
    setArticles((cur) =>
      cur.map((a) =>
        a.id === id
          ? {
              ...a,
              title: draft.title,
              body: draft.body,
              slug: draft.slug,
              iconKey: draft.iconKey,
              imageUrl: draft.imageUrl || null,
              videoUrl: draft.videoUrl || null,
              priority: draft.priority,
              published: draft.published,
            }
          : a,
      ),
    );
    return { ok: true };
  };

  const createArticle = async (): Promise<void> => {
    setBusy(true);
    setCreateError(null);
    const stamp = Date.now().toString(36);
    const payload = {
      slug: `nueva-guia-${stamp}`,
      title: 'Nueva guía',
      body: 'Escribe aquí el contenido de la guía…',
      iconKey: 'book-open',
      priority: 0,
      published: false,
    };
    const res = await fetch('/api/admin/support', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!res.ok) {
      setCreateError('No pudimos crear la guía.');
      return;
    }
    const data = (await res.json()) as { article: SupportArticleRow };
    if (data.article) {
      setArticles((cur) => [
        {
          ...data.article,
          createdAt: new Date(data.article.createdAt),
          updatedAt: new Date(data.article.updatedAt),
        },
        ...cur,
      ]);
      setEditingId(data.article.id);
    }
    router.refresh();
  };

  const confirmDelete = async (): Promise<void> => {
    if (!deleting) return;
    setBusy(true);
    const res = await fetch(`/api/admin/support/${deleting.id}`, {
      method: 'DELETE',
    });
    setBusy(false);
    if (!res.ok) return;
    setArticles((cur) => cur.filter((a) => a.id !== deleting.id));
    setDeleting(null);
  };

  const visible = isAdmin ? articles : articles.filter((a) => a.published);

  return (
    <>
      {visible.length === 0 ? (
        <p
          data-testid="soporte-empty"
          className="mt-10 rounded-3xl bg-white p-8 text-sm text-zinc-500 ring-1 ring-zinc-200"
        >
          Estamos preparando los primeros manuales. Vuelve pronto.
        </p>
      ) : (
        <div data-testid="soporte-articles" className="mt-8 grid gap-4">
          {visible.map((a, i) => (
            <ArticleCard
              key={a.id}
              article={a}
              delayMs={120 + i * 60}
              isAdmin={isAdmin}
              onEdit={() => setEditingId(a.id)}
              onDelete={() => setDeleting(a)}
            />
          ))}
        </div>
      )}

      {isAdmin && (
        <div className="mt-8 flex flex-col items-start gap-2">
          <button
            type="button"
            onClick={() => void createArticle()}
            disabled={busy}
            data-testid="soporte-new-article"
            className="inline-flex h-10 items-center gap-2 rounded-full bg-sensu-500 px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 disabled:opacity-60 cursor-pointer"
          >
            <LuPlus aria-hidden className="h-4 w-4" />
            Nueva guía
          </button>
          {createError && (
            <p className="text-xs text-rose-600">{createError}</p>
          )}
        </div>
      )}

      {isAdmin && (
        <SoporteArticleEditModal
          open={editingId !== null}
          article={editingArticle}
          onCancel={() => setEditingId(null)}
          onSave={(draft) =>
            editingArticle
              ? patchArticle(editingArticle.id, draft)
              : Promise.resolve({ ok: false })
          }
        />
      )}

      {isAdmin && (
        <ConfirmModal
          open={deleting !== null}
          onCancel={() => setDeleting(null)}
          onConfirm={confirmDelete}
          title={deleting ? `Eliminar "${deleting.title}"` : 'Eliminar guía'}
          body="Esta acción es permanente. La guía desaparece de /soporte de inmediato."
          busy={busy}
          testId="soporte-delete-modal"
        />
      )}
    </>
  );
}

function ArticleCard({
  article,
  delayMs,
  isAdmin,
  onEdit,
  onDelete,
}: {
  article: SupportArticleRow;
  delayMs: number;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
}): React.ReactElement {
  const tone = getSupportIconCircleClasses(article.iconKey);
  const testId = `support-article-${article.slug}`;
  const hasMedia = !!(article.imageUrl || article.videoUrl);

  return (
    <article
      id={`article-${article.slug}`}
      data-testid={testId}
      className="card-surface relative scroll-mt-24 rounded-3xl p-6 animate-fade-up"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      {isAdmin && (
        <div className="absolute right-4 top-4 flex items-center gap-2">
          {!article.published && (
            <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
              Borrador
            </span>
          )}
          <button
            type="button"
            onClick={onEdit}
            data-testid={`${testId}-edit`}
            title="Editar guía"
            aria-label={`Editar ${article.title}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-sensu-600 opacity-90 shadow-sm ring-1 ring-inset ring-sensu-200 transition-opacity hover:opacity-100 cursor-pointer"
          >
            <LuPencil aria-hidden className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            data-testid={`${testId}-delete`}
            title="Eliminar"
            aria-label={`Eliminar ${article.title}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-rose-600 ring-1 ring-inset ring-rose-200 transition-colors hover:bg-rose-50 cursor-pointer"
          >
            <LuTrash2 aria-hidden className="h-4 w-4" />
          </button>
        </div>
      )}
      <header className="flex items-start gap-3 pr-24">
        <span
          className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tone.bg} ${tone.fg}`}
        >
          <SupportIcon iconKey={article.iconKey} className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
            {article.title}
          </h2>
        </div>
      </header>
      <div
        className={
          hasMedia ? 'mt-4 grid gap-5 sm:grid-cols-[12rem_1fr]' : 'mt-4'
        }
      >
        {hasMedia ? (
          <MediaLightbox
            imageUrl={article.imageUrl}
            videoUrl={article.videoUrl}
            title={article.title}
            testId={testId}
          />
        ) : null}
        <div className="min-w-0 whitespace-pre-wrap text-sm text-zinc-700 leading-relaxed">
          {article.body}
        </div>
      </div>
    </article>
  );
}
