'use client';

import { useRef, useState } from 'react';
import { LuUpload } from 'react-icons/lu';
import { Modal } from './modal';

/**
 * Single-modal editor for one testimonial card (Ustym 2026-05-29).
 *
 * The previous design dropped a tiny pencil over the 56×56 avatar
 * inside a narrow carousel slide — admins couldn't actually see
 * what they were clicking, and the dropdown that opened was cut off
 * by the slide edge. This modal collects every field of the card
 * (quote, name, relation, photo) into one focused form so a single
 * pencil per card is enough.
 */
export interface TestimonialEditDraft {
  quote: string;
  name: string;
  relation: string;
  photoUrl: string;
}

export function TestimonialEditModal({
  open,
  slugBase,
  initial,
  onCancel,
  onSave,
}: {
  open: boolean;
  slugBase: string;
  initial: TestimonialEditDraft;
  onCancel: () => void;
  onSave: (draft: TestimonialEditDraft) => Promise<{ ok: boolean; error?: string }>;
}): React.ReactElement {
  const [draft, setDraft] = useState<TestimonialEditDraft>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Reset the draft whenever the modal flips back open. Otherwise the
  // user would see whatever they typed during the previous open after
  // they cancelled and came back in.
  // (We intentionally do not depend on `initial` so a parent that
  // re-creates the object doesn't reset typing in-progress.)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useStableResetOnOpen(open, () => {
    setDraft(initial);
    setBusy(false);
    setUploadingPhoto(false);
    setError(null);
  });

  const onPhotoChosen = async (file: File): Promise<void> => {
    setUploadingPhoto(true);
    setError(null);
    try {
      const form = new FormData();
      form.set('file', file);
      form.set('slug', `${slugBase}-photo`);
      const res = await fetch('/api/admin/landing/upload', {
        method: 'POST',
        body: form,
      });
      if (!res.ok) {
        setError('La subida a Cloudinary falló.');
        return;
      }
      const { url } = (await res.json()) as { url: string };
      setDraft((d) => ({ ...d, photoUrl: url }));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const save = async (): Promise<void> => {
    if (draft.quote.trim().length === 0 || draft.name.trim().length === 0) {
      setError('La cita y el nombre son obligatorios.');
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
      onCancel(); // close
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!busy && !uploadingPhoto) onCancel();
      }}
      title="Editar testimonio"
      testId={`testimonial-edit-modal-${slugBase}`}
      size="md"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="space-y-4"
      >
        <Field label="Cita">
          <textarea
            value={draft.quote}
            onChange={(e) => setDraft({ ...draft, quote: e.target.value })}
            rows={4}
            required
            data-testid={`testimonial-edit-${slugBase}-quote`}
            className="w-full resize-y rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-sensu-400 focus:ring-2 focus:ring-sensu-200"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre">
            <input
              type="text"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              required
              data-testid={`testimonial-edit-${slugBase}-name`}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-sensu-400 focus:ring-2 focus:ring-sensu-200"
            />
          </Field>
          <Field label="Relación / ciudad">
            <input
              type="text"
              value={draft.relation}
              onChange={(e) => setDraft({ ...draft, relation: e.target.value })}
              data-testid={`testimonial-edit-${slugBase}-relation`}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-sensu-400 focus:ring-2 focus:ring-sensu-200"
            />
          </Field>
        </div>
        <Field label="Foto del testimonio">
          <div className="flex items-center gap-3">
            <img
              src={draft.photoUrl}
              alt={draft.name}
              className="h-16 w-16 rounded-full object-cover ring-1 ring-zinc-100"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              data-testid={`testimonial-edit-${slugBase}-file-input`}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onPhotoChosen(f);
              }}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
              data-testid={`testimonial-edit-${slugBase}-upload`}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-3 text-xs font-medium text-sensu-700 ring-1 ring-inset ring-sensu-200 transition-colors hover:bg-sensu-50 disabled:opacity-60 cursor-pointer"
            >
              <LuUpload aria-hidden className="h-4 w-4" />
              {uploadingPhoto ? 'Subiendo…' : 'Subir nueva foto'}
            </button>
          </div>
        </Field>
        {error && (
          <p
            data-testid={`testimonial-edit-${slugBase}-error`}
            className="text-sm text-rose-600"
          >
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy || uploadingPhoto}
            className="inline-flex h-10 items-center rounded-full bg-white px-4 text-sm font-medium text-zinc-700 ring-1 ring-inset ring-zinc-200 transition-colors hover:bg-zinc-50 disabled:opacity-50 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={busy || uploadingPhoto}
            data-testid={`testimonial-edit-${slugBase}-save`}
            className="inline-flex h-10 items-center rounded-full bg-sensu-500 px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 disabled:opacity-60 cursor-pointer"
          >
            {busy ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

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

// Tiny effect helper — runs `reset` whenever `open` flips from false to
// true. Avoids depending on the parent's `initial` reference identity.
function useStableResetOnOpen(open: boolean, reset: () => void): void {
  const prev = useRef(open);
  if (!prev.current && open) {
    reset();
  }
  prev.current = open;
}
