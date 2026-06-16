'use client';

import { useState, type ElementType, type KeyboardEvent } from 'react';
import { LuCheck, LuPencil, LuX } from 'react-icons/lu';

/**
 * Inline editable text (Ustym 2026-05-28).
 *
 * Renders `as` HTML element with `initialText` (already merged
 * server-side from any LandingItem override). When `isAdmin` is true,
 * overlays a pencil icon in the top-right corner; clicking it swaps
 * the element for a textarea + Save / Cancel controls and PATCHes
 * /api/admin/landing/[slug] on save.
 *
 * Non-admins render exactly the element they would have rendered if
 * this component did not exist — zero visual difference for visitors.
 */
export function EditableText({
  slug,
  initialText,
  isAdmin,
  as: Tag = 'span',
  className = '',
  multiline = false,
  onSave,
}: {
  slug: string;
  initialText: string;
  isAdmin: boolean;
  as?: ElementType;
  className?: string;
  multiline?: boolean;
  /**
   * Optional save handler. When provided, the component delegates the
   * persistence step here instead of PATCHing /api/admin/landing/[slug].
   * Lets other surfaces (e.g. /soporte article cards) reuse the same
   * inline editor without forking the UI.
   */
  onSave?: (text: string) => Promise<{ ok: boolean; error?: string }>;
}): React.ReactElement {
  const [text, setText] = useState(initialText);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialText);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Visitor render — plain tag, identical to the legacy markup but
  // tagged with the slug so visitor specs can assert against the same
  // testid as the admin lens.
  if (!isAdmin) {
    return (
      <Tag className={className} data-testid={`editable-text-${slug}`}>
        {text}
      </Tag>
    );
  }

  const save = async (): Promise<void> => {
    if (draft.trim().length === 0) {
      setError('No puede quedar vacío.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (onSave) {
        const result = await onSave(draft);
        if (!result.ok) {
          setError(result.error ?? 'No pudimos guardar. Inténtalo de nuevo.');
          return;
        }
      } else {
        const res = await fetch(`/api/admin/landing/${slug}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            kind: 'TEXT',
            content: { text: draft },
          }),
        });
        if (!res.ok) {
          setError('No pudimos guardar. Inténtalo de nuevo.');
          return;
        }
      }
      setText(draft);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  const cancel = (): void => {
    if (busy) return;
    setDraft(text);
    setEditing(false);
    setError(null);
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    } else if (e.key === 'Enter' && !multiline && !e.shiftKey) {
      e.preventDefault();
      void save();
    } else if (e.key === 'Enter' && multiline && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void save();
    }
  };

  if (editing) {
    return (
      <div
        data-testid={`editable-text-${slug}-editor`}
        className="group relative w-full"
        // Stop pointerdown from bubbling to any parent that hijacks
        // the pointer (e.g. the testimonial carousel's drag tracker
        // via setPointerCapture) — without this the carousel steals
        // the click before the input or save button receive it.
        onPointerDown={(e) => e.stopPropagation()}
      >
        {multiline ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKey}
            autoFocus
            rows={Math.max(3, Math.min(10, draft.split('\n').length + 1))}
            data-testid={`editable-text-${slug}-input`}
            className={`block w-full resize-y rounded-xl border-2 border-sensu-300 bg-white px-3 py-2 outline-none focus:border-sensu-500 focus:ring-2 focus:ring-sensu-200 ${className}`}
          />
        ) : (
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKey}
            autoFocus
            data-testid={`editable-text-${slug}-input`}
            className={`block w-full rounded-xl border-2 border-sensu-300 bg-white px-3 py-2 outline-none focus:border-sensu-500 focus:ring-2 focus:ring-sensu-200 ${className}`}
          />
        )}
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy}
            data-testid={`editable-text-${slug}-save`}
            className="inline-flex h-8 items-center gap-1 rounded-full bg-sensu-500 px-3 text-xs font-medium text-white transition-transform hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-60 cursor-pointer"
          >
            <LuCheck aria-hidden className="h-3.5 w-3.5" />
            {busy ? 'Guardando…' : 'Guardar'}
          </button>
          <button
            type="button"
            onClick={cancel}
            disabled={busy}
            data-testid={`editable-text-${slug}-cancel`}
            className="inline-flex h-8 items-center gap-1 rounded-full bg-white px-3 text-xs font-medium text-zinc-700 ring-1 ring-inset ring-zinc-200 transition-colors hover:bg-zinc-50 disabled:opacity-50 cursor-pointer"
          >
            <LuX aria-hidden className="h-3.5 w-3.5" />
            Cancelar
          </button>
          {error && (
            <span
              data-testid={`editable-text-${slug}-error`}
              className="text-xs text-rose-600"
            >
              {error}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid={`editable-text-${slug}`}
      className="group relative"
    >
      <Tag className={className}>{text}</Tag>
      <button
        type="button"
        onClick={() => {
          setDraft(text);
          setEditing(true);
        }}
        // Drag-tracking parents (e.g. TestimonialCarousel) call
        // setPointerCapture on pointerdown, which steals the click
        // before it reaches this button. Stopping pointerdown
        // bubbling here keeps the click intact.
        onPointerDown={(e) => e.stopPropagation()}
        data-testid={`editable-text-${slug}-pencil`}
        title="Editar"
        aria-label={`Editar ${slug}`}
        className="absolute -right-2 -top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-sensu-600 opacity-60 shadow-sm ring-1 ring-inset ring-sensu-200 transition-opacity hover:opacity-100 group-hover:opacity-100 cursor-pointer"
      >
        <LuPencil aria-hidden className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
