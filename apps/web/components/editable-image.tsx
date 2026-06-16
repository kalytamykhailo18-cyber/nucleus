'use client';

import { useRef, useState } from 'react';
import { LuCheck, LuPencil, LuUpload, LuX } from 'react-icons/lu';

/**
 * Inline editable image (Ustym 2026-05-28).
 *
 * Renders an `<img>` with `initialUrl` (already merged server-side
 * from any LandingItem override). When `isAdmin` is true, overlays a
 * pencil icon in the top-right corner; clicking it opens a small
 * dropdown with a file picker + alt-text input. On save, the file
 * uploads to /api/admin/landing/upload (Cloudinary) and the resulting
 * URL is PATCHed to /api/admin/landing/[slug].
 *
 * Non-admins see exactly the `<img>` they would have seen.
 */
export function EditableImage({
  slug,
  initialUrl,
  initialAlt,
  isAdmin,
  className = '',
  onSave,
}: {
  slug: string;
  initialUrl: string;
  initialAlt: string;
  isAdmin: boolean;
  className?: string;
  /**
   * Optional save handler. When provided, the component delegates the
   * persistence step here instead of PATCHing /api/admin/landing/[slug].
   * Cloudinary upload still goes through /api/admin/landing/upload —
   * only the metadata save is callback-overrideable.
   */
  onSave?: (url: string, alt: string) => Promise<{ ok: boolean; error?: string }>;
}): React.ReactElement {
  const [url, setUrl] = useState(initialUrl);
  const [alt, setAlt] = useState(initialAlt);
  const [editing, setEditing] = useState(false);
  const [draftAlt, setDraftAlt] = useState(initialAlt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isAdmin) {
    return <img src={url} alt={alt} className={className} />;
  }

  const cancel = (): void => {
    if (busy) return;
    setDraftAlt(alt);
    setEditing(false);
    setError(null);
  };

  const persist = async (
    newUrl: string,
    newAlt: string,
  ): Promise<{ ok: boolean; error?: string }> => {
    if (onSave) return onSave(newUrl, newAlt);
    const res = await fetch(`/api/admin/landing/${slug}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        kind: 'IMAGE',
        content: { url: newUrl, alt: newAlt },
      }),
    });
    return res.ok ? { ok: true } : { ok: false };
  };

  const saveAltOnly = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const result = await persist(url, draftAlt);
      if (!result.ok) {
        setError(result.error ?? 'No pudimos guardar.');
        return;
      }
      setAlt(draftAlt);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  const uploadAndSave = async (file: File): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const upload = new FormData();
      upload.set('file', file);
      upload.set('slug', slug);
      const up = await fetch('/api/admin/landing/upload', {
        method: 'POST',
        body: upload,
      });
      if (!up.ok) {
        setError('La subida a Cloudinary falló.');
        return;
      }
      const { url: newUrl } = (await up.json()) as { url: string };

      const result = await persist(newUrl, draftAlt);
      if (!result.ok) {
        setError(result.error ?? 'No pudimos guardar la nueva imagen.');
        return;
      }
      setUrl(newUrl);
      setAlt(draftAlt);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <span
      data-testid={`editable-image-${slug}`}
      className="group relative inline-block"
    >
      <img src={url} alt={alt} className={className} />
      <button
        type="button"
        onClick={() => {
          setDraftAlt(alt);
          setEditing((v) => !v);
        }}
        // Stop pointerdown bubbling so drag-tracking parents (e.g.
        // TestimonialCarousel) don't capture the pointer and steal
        // the click before it lands on this button.
        onPointerDown={(e) => e.stopPropagation()}
        data-testid={`editable-image-${slug}-pencil`}
        title="Editar"
        aria-label={`Editar imagen ${slug}`}
        className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-sensu-600 opacity-80 shadow-sm ring-1 ring-inset ring-sensu-200 transition-opacity hover:opacity-100 group-hover:opacity-100 cursor-pointer"
      >
        <LuPencil aria-hidden className="h-4 w-4" />
      </button>
      {editing && (
        <span
          data-testid={`editable-image-${slug}-editor`}
          className="absolute right-2 top-12 z-10 block w-72 rounded-xl bg-white p-3 text-left text-sm shadow-lg ring-1 ring-zinc-200"
          // Keep clicks on the file picker / alt input / save buttons
          // out of any drag-tracking parent's pointer capture.
          onPointerDown={(e) => e.stopPropagation()}
        >
          <label className="block">
            <span className="block text-xs uppercase tracking-[0.14em] text-zinc-500">
              Texto alternativo
            </span>
            <input
              type="text"
              value={draftAlt}
              onChange={(e) => setDraftAlt(e.target.value)}
              data-testid={`editable-image-${slug}-alt-input`}
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-sensu-400 focus:ring-2 focus:ring-sensu-200"
            />
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            data-testid={`editable-image-${slug}-file-input`}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadAndSave(f);
            }}
            className="hidden"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
              data-testid={`editable-image-${slug}-upload`}
              className="inline-flex h-8 items-center gap-1 rounded-full bg-sensu-500 px-3 text-xs font-medium text-white transition-transform hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-60 cursor-pointer"
            >
              <LuUpload aria-hidden className="h-3.5 w-3.5" />
              {busy ? 'Subiendo…' : 'Subir imagen'}
            </button>
            <button
              type="button"
              onClick={() => void saveAltOnly()}
              disabled={busy}
              data-testid={`editable-image-${slug}-save-alt`}
              className="inline-flex h-8 items-center gap-1 rounded-full bg-white px-3 text-xs font-medium text-zinc-700 ring-1 ring-inset ring-zinc-200 transition-colors hover:bg-zinc-50 disabled:opacity-50 cursor-pointer"
            >
              <LuCheck aria-hidden className="h-3.5 w-3.5" />
              Guardar alt
            </button>
            <button
              type="button"
              onClick={cancel}
              disabled={busy}
              data-testid={`editable-image-${slug}-cancel`}
              className="inline-flex h-8 items-center gap-1 rounded-full bg-white px-3 text-xs font-medium text-zinc-700 ring-1 ring-inset ring-zinc-200 transition-colors hover:bg-zinc-50 disabled:opacity-50 cursor-pointer"
            >
              <LuX aria-hidden className="h-3.5 w-3.5" />
              Cerrar
            </button>
          </div>
          {error && (
            <p
              data-testid={`editable-image-${slug}-error`}
              className="mt-2 text-xs text-rose-600"
            >
              {error}
            </p>
          )}
        </span>
      )}
    </span>
  );
}
