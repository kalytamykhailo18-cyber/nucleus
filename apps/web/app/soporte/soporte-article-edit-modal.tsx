'use client';

import { useRef, useState } from 'react';
import { LuUpload } from 'react-icons/lu';
import { Modal } from '@/components/modal';
import {
  SUPPORT_ICON_KEYS,
} from '@/components/support-icon';
import type { SupportArticleRow } from '@/lib/support';

/**
 * Single-modal editor for one /soporte article (Ustym 2026-05-29).
 *
 * Same UX pattern as the testimonial and landing card modals — admin
 * gets ONE pencil per article that opens this focused form with every
 * field of the article (title, body, icon, image, video URL, slug,
 * priority, published). Image upload goes to Cloudinary; Save fires
 * a single PATCH /api/admin/support/[id] with the merged payload.
 */
export interface SoporteArticleDraft {
  title: string;
  body: string;
  iconKey: string;
  imageUrl: string;
  videoUrl: string;
  slug: string;
  priority: number;
  published: boolean;
}

export function SoporteArticleEditModal({
  open,
  article,
  onCancel,
  onSave,
}: {
  open: boolean;
  article: SupportArticleRow | null;
  onCancel: () => void;
  onSave: (draft: SoporteArticleDraft) => Promise<{ ok: boolean; error?: string }>;
}): React.ReactElement | null {
  const [draft, setDraft] = useState<SoporteArticleDraft>(() =>
    article
      ? {
          title: article.title,
          body: article.body,
          iconKey: article.iconKey,
          imageUrl: article.imageUrl ?? '',
          videoUrl: article.videoUrl ?? '',
          slug: article.slug,
          priority: article.priority,
          published: article.published,
        }
      : EMPTY,
  );
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Re-seed draft each time the modal flips open against a new article.
  const prevOpenRef = useRef({ open, id: article?.id });
  if (
    (!prevOpenRef.current.open && open) ||
    prevOpenRef.current.id !== article?.id
  ) {
    setDraft(
      article
        ? {
            title: article.title,
            body: article.body,
            iconKey: article.iconKey,
            imageUrl: article.imageUrl ?? '',
            videoUrl: article.videoUrl ?? '',
            slug: article.slug,
            priority: article.priority,
            published: article.published,
          }
        : EMPTY,
    );
    setBusy(false);
    setUploading(false);
    setError(null);
  }
  prevOpenRef.current = { open, id: article?.id };

  if (!article) return null;

  const uploadImage = async (file: File): Promise<void> => {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.set('file', file);
      form.set('slug', `soporte-${article.slug}-image`);
      const res = await fetch('/api/admin/landing/upload', {
        method: 'POST',
        body: form,
      });
      if (!res.ok) {
        setError('La subida a Cloudinary falló.');
        return;
      }
      const { url } = (await res.json()) as { url: string };
      setDraft((d) => ({ ...d, imageUrl: url }));
    } finally {
      setUploading(false);
    }
  };

  const save = async (): Promise<void> => {
    if (draft.title.trim().length === 0 || draft.slug.trim().length === 0) {
      setError('El título y el slug son obligatorios.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await onSave(draft);
      if (!result.ok) {
        setError(result.error ?? 'No pudimos guardar.');
        return;
      }
      onCancel();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!busy && !uploading) onCancel();
      }}
      title="Editar guía"
      testId={`soporte-article-edit-modal-${article.id}`}
      size="lg"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="space-y-4"
      >
        <Field label="Título">
          <input
            type="text"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            required
            data-testid="soporte-edit-title"
            className={INPUT_CLS}
          />
        </Field>
        <Field label="Cuerpo">
          <textarea
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            rows={6}
            data-testid="soporte-edit-body"
            className={`${INPUT_CLS} resize-y`}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Slug">
            <input
              type="text"
              value={draft.slug}
              onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
              required
              data-testid="soporte-edit-slug"
              className={INPUT_CLS}
            />
          </Field>
          <Field label="Ícono">
            <select
              value={draft.iconKey}
              onChange={(e) => setDraft({ ...draft, iconKey: e.target.value })}
              data-testid="soporte-edit-icon"
              className={INPUT_CLS}
            >
              {SUPPORT_ICON_KEYS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Imagen (opcional)">
          <div className="flex items-center gap-3">
            {draft.imageUrl ? (
              <img
                src={draft.imageUrl}
                alt=""
                className="h-16 w-16 rounded-xl object-cover ring-1 ring-zinc-100"
              />
            ) : (
              <span className="inline-flex h-16 w-16 items-center justify-center rounded-xl bg-zinc-100 text-xs text-zinc-400">
                —
              </span>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              data-testid="soporte-edit-image-file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadImage(f);
              }}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              data-testid="soporte-edit-image-upload"
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-3 text-xs font-medium text-sensu-700 ring-1 ring-inset ring-sensu-200 transition-colors hover:bg-sensu-50 disabled:opacity-60 cursor-pointer"
            >
              <LuUpload aria-hidden className="h-4 w-4" />
              {uploading ? 'Subiendo…' : 'Subir nueva imagen'}
            </button>
            {draft.imageUrl && (
              <button
                type="button"
                onClick={() => setDraft({ ...draft, imageUrl: '' })}
                className="text-xs text-rose-600 hover:underline cursor-pointer"
              >
                Quitar
              </button>
            )}
          </div>
        </Field>
        <Field label="Video URL (opcional)">
          <input
            type="url"
            value={draft.videoUrl}
            onChange={(e) => setDraft({ ...draft, videoUrl: e.target.value })}
            placeholder="https://…"
            data-testid="soporte-edit-video"
            className={INPUT_CLS}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Prioridad">
            <input
              type="number"
              value={draft.priority}
              onChange={(e) =>
                setDraft({ ...draft, priority: Number(e.target.value) || 0 })
              }
              data-testid="soporte-edit-priority"
              className={INPUT_CLS}
            />
          </Field>
          <Field label="Estado">
            <label className="flex h-10 items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={draft.published}
                onChange={(e) =>
                  setDraft({ ...draft, published: e.target.checked })
                }
                data-testid="soporte-edit-published"
              />
              <span>{draft.published ? 'Publicada' : 'Borrador'}</span>
            </label>
          </Field>
        </div>
        {error && (
          <p
            data-testid={`soporte-article-edit-modal-${article.id}-error`}
            className="text-sm text-rose-600"
          >
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy || uploading}
            className="inline-flex h-10 items-center rounded-full bg-white px-4 text-sm font-medium text-zinc-700 ring-1 ring-inset ring-zinc-200 transition-colors hover:bg-zinc-50 disabled:opacity-50 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={busy || uploading}
            data-testid={`soporte-article-edit-modal-${article.id}-save`}
            className="inline-flex h-10 items-center rounded-full bg-sensu-500 px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 disabled:opacity-60 cursor-pointer"
          >
            {busy ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const EMPTY: SoporteArticleDraft = {
  title: '',
  body: '',
  iconKey: 'book-open',
  imageUrl: '',
  videoUrl: '',
  slug: '',
  priority: 0,
  published: false,
};

const INPUT_CLS =
  'w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-sensu-400 focus:ring-2 focus:ring-sensu-200';

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <label className="block text-sm">
      <span className="block text-xs uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
