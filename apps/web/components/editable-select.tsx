'use client';

import { useState, type ReactNode } from 'react';
import { LuCheck, LuPencil, LuX } from 'react-icons/lu';

/**
 * Inline editable select (Ustym 2026-05-29).
 *
 * Companion to EditableText / EditableImage for fields backed by a
 * fixed enumeration (e.g. SupportArticle icon key). Renders `display`
 * as the visitor view; admins get a pencil that opens an inline
 * dropdown of options. Save invokes the `onSave` callback with the
 * picked value.
 */
export function EditableSelect({
  slug,
  initialValue,
  options,
  isAdmin,
  display,
  onSave,
}: {
  slug: string;
  initialValue: string;
  options: Array<{ value: string; label: string }>;
  isAdmin: boolean;
  display: ReactNode;
  onSave: (value: string) => Promise<{ ok: boolean; error?: string }>;
}): React.ReactElement {
  const [value, setValue] = useState(initialValue);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isAdmin) {
    return <span data-testid={`editable-select-${slug}`}>{display}</span>;
  }

  const save = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const result = await onSave(draft);
      if (!result.ok) {
        setError(result.error ?? 'No pudimos guardar.');
        return;
      }
      setValue(draft);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  const cancel = (): void => {
    if (busy) return;
    setDraft(value);
    setEditing(false);
    setError(null);
  };

  return (
    <span
      data-testid={`editable-select-${slug}`}
      className="group relative inline-block"
    >
      {display}
      <button
        type="button"
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        data-testid={`editable-select-${slug}-pencil`}
        title="Editar"
        aria-label={`Editar ${slug}`}
        className="absolute -right-2 -top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-sensu-600 opacity-60 shadow-sm ring-1 ring-inset ring-sensu-200 transition-opacity hover:opacity-100 group-hover:opacity-100 cursor-pointer"
      >
        <LuPencil aria-hidden className="h-3.5 w-3.5" />
      </button>
      {editing && (
        <span
          data-testid={`editable-select-${slug}-editor`}
          className="absolute left-0 top-12 z-10 block w-56 rounded-xl bg-white p-3 text-left text-sm shadow-lg ring-1 ring-zinc-200"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <select
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            data-testid={`editable-select-${slug}-input`}
            className="block w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-sensu-400 focus:ring-2 focus:ring-sensu-200"
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy}
              data-testid={`editable-select-${slug}-save`}
              className="inline-flex h-8 items-center gap-1 rounded-full bg-sensu-500 px-3 text-xs font-medium text-white transition-transform hover:-translate-y-0.5 disabled:opacity-60 cursor-pointer"
            >
              <LuCheck aria-hidden className="h-3.5 w-3.5" />
              {busy ? 'Guardando…' : 'Guardar'}
            </button>
            <button
              type="button"
              onClick={cancel}
              disabled={busy}
              data-testid={`editable-select-${slug}-cancel`}
              className="inline-flex h-8 items-center gap-1 rounded-full bg-white px-3 text-xs font-medium text-zinc-700 ring-1 ring-inset ring-zinc-200 transition-colors hover:bg-zinc-50 disabled:opacity-50 cursor-pointer"
            >
              <LuX aria-hidden className="h-3.5 w-3.5" />
              Cancelar
            </button>
          </div>
          {error && (
            <p
              data-testid={`editable-select-${slug}-error`}
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
