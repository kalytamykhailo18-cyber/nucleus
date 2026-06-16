'use client';

import { useRef, useState } from 'react';
import { LuUpload } from 'react-icons/lu';
import { Modal } from './modal';

/**
 * Generic single-modal editor for landing-page cards (Ustym 2026-05-29).
 *
 * Pattern adopted from TestimonialEditModal — instead of dropping a
 * tiny pencil on every editable element inside a card, the admin gets
 * ONE pencil at the top-right of the card and one focused modal that
 * collects every field of that card. Each section in /page.tsx passes
 * its own field definitions; the modal renders the right form widget
 * per field type, uploads images to Cloudinary, and fires a single
 * `onSave` with the new values keyed by field slug suffix.
 */

export interface CardEditField {
  /** Slug suffix appended to `slugBase` to derive the LandingItem row id. */
  key: string;
  /** Field label rendered above the input. */
  label: string;
  /**
   * Form widget to render. `multiline` is a `<textarea>` for long copy.
   * `video` is a URL text input (admin pastes YouTube / Vimeo / Cloudinary
   * /video/upload / direct mp4) — the renderer detects the source by URL
   * pattern and embeds accordingly. No video upload widget today: pasting
   * a URL is enough for the marketing surface and avoids re-encoding cost.
   */
  type: 'text' | 'multiline' | 'image' | 'video';
  /** Current value (default + override merged server-side). */
  initial: string;
  /** Optional placeholder for empty inputs. */
  placeholder?: string;
  /**
   * Optional override for the LandingItem slug this field persists to.
   * When omitted, the slug is `${slugBase}-${key}` (the historical
   * convention for multi-field cards). Standalone-image cards where
   * `slugBase` already encodes the section name — e.g. `product-image`,
   * `coverage-image` — set this to the slugBase itself so save and
   * render line up on the same row instead of producing the
   * double-stutter `product-image-image` slug that orphans the render.
   */
  slug?: string;
}

export function CardEditModal({
  open,
  slugBase,
  title,
  fields,
  onCancel,
  onSave,
}: {
  open: boolean;
  slugBase: string;
  title: string;
  fields: CardEditField[];
  onCancel: () => void;
  onSave: (values: Record<string, string>) => Promise<{ ok: boolean; error?: string }>;
}): React.ReactElement {
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, f.initial])),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  // Re-seed the draft each time the modal flips open. Without this an
  // admin who edits A, cancels, then opens B would see A's values.
  const prevOpen = useRef(open);
  if (!prevOpen.current && open) {
    setDraft(Object.fromEntries(fields.map((f) => [f.key, f.initial])));
    setBusy(false);
    setUploadingKey(null);
    setError(null);
  }
  prevOpen.current = open;

  const uploadImage = async (key: string, file: File): Promise<void> => {
    setUploadingKey(key);
    setError(null);
    try {
      const form = new FormData();
      form.set('file', file);
      form.set('slug', `${slugBase}-${key}`);
      const res = await fetch('/api/admin/landing/upload', {
        method: 'POST',
        body: form,
      });
      if (!res.ok) {
        setError('La subida a Cloudinary falló.');
        return;
      }
      const { url } = (await res.json()) as { url: string };
      setDraft((d) => ({ ...d, [key]: url }));
    } finally {
      setUploadingKey(null);
    }
  };

  const save = async (): Promise<void> => {
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
        if (!busy && !uploadingKey) onCancel();
      }}
      title={title}
      testId={`card-edit-modal-${slugBase}`}
      size="md"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="space-y-4"
      >
        {fields.map((f) => (
          <FieldRow
            key={f.key}
            field={f}
            value={draft[f.key] ?? ''}
            onTextChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }))}
            onFile={(file) => void uploadImage(f.key, file)}
            uploading={uploadingKey === f.key}
            slugBase={slugBase}
          />
        ))}
        {error && (
          <p
            data-testid={`card-edit-modal-${slugBase}-error`}
            className="text-sm text-rose-600"
          >
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy || uploadingKey !== null}
            className="inline-flex h-10 items-center rounded-full bg-white px-4 text-sm font-medium text-zinc-700 ring-1 ring-inset ring-zinc-200 transition-colors hover:bg-zinc-50 disabled:opacity-50 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={busy || uploadingKey !== null}
            data-testid={`card-edit-modal-${slugBase}-save`}
            className="inline-flex h-10 items-center rounded-full bg-sensu-500 px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 disabled:opacity-60 cursor-pointer"
          >
            {busy ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function FieldRow({
  field,
  value,
  onTextChange,
  onFile,
  uploading,
  slugBase,
}: {
  field: CardEditField;
  value: string;
  onTextChange: (v: string) => void;
  onFile: (f: File) => void;
  uploading: boolean;
  slugBase: string;
}): React.ReactElement {
  const fileRef = useRef<HTMLInputElement>(null);
  const testId = `card-edit-${slugBase}-${field.key}`;

  return (
    <label className="block text-sm">
      <span className="block text-xs uppercase tracking-[0.14em] text-zinc-500">
        {field.label}
      </span>
      <div className="mt-1.5">
        {field.type === 'text' ? (
          <input
            type="text"
            value={value}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder={field.placeholder}
            data-testid={testId}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-sensu-400 focus:ring-2 focus:ring-sensu-200"
          />
        ) : field.type === 'multiline' ? (
          <textarea
            value={value}
            onChange={(e) => onTextChange(e.target.value)}
            rows={4}
            placeholder={field.placeholder}
            data-testid={testId}
            className="w-full resize-y rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-sensu-400 focus:ring-2 focus:ring-sensu-200"
          />
        ) : field.type === 'video' ? (
          <input
            type="url"
            value={value}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder={field.placeholder ?? 'https://youtube.com/watch?v=...'}
            data-testid={testId}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-sensu-400 focus:ring-2 focus:ring-sensu-200"
          />
        ) : (
          <div className="flex items-center gap-3">
            {value ? (
              <img
                src={value}
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
              data-testid={`${testId}-file`}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
              }}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              data-testid={`${testId}-upload`}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-3 text-xs font-medium text-sensu-700 ring-1 ring-inset ring-sensu-200 transition-colors hover:bg-sensu-50 disabled:opacity-60 cursor-pointer"
            >
              <LuUpload aria-hidden className="h-4 w-4" />
              {uploading ? 'Subiendo…' : 'Subir imagen'}
            </button>
          </div>
        )}
      </div>
    </label>
  );
}

/**
 * Helper for the parent component: persist a batch of field values by
 * firing one PATCH per slug in parallel. Returns ok=true only if every
 * PATCH succeeded.
 */
export async function saveLandingFields(
  slugBase: string,
  values: Record<string, string>,
  fields: CardEditField[],
): Promise<{ ok: boolean; error?: string }> {
  const requests = fields.map((f) => {
    const slug = f.slug ?? `${slugBase}-${f.key}`;
    const body =
      f.type === 'image'
        ? { kind: 'IMAGE', content: { url: values[f.key] ?? '', alt: '' } }
        : f.type === 'video'
          ? { kind: 'VIDEO', content: { url: values[f.key] ?? '' } }
          : { kind: 'TEXT', content: { text: values[f.key] ?? '' } };
    return fetch(`/api/admin/landing/${slug}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  });
  const results = await Promise.all(requests);
  if (results.some((r) => !r.ok)) {
    return { ok: false, error: 'No pudimos guardar todos los campos.' };
  }
  return { ok: true };
}
