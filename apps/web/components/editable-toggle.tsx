'use client';

import { useState } from 'react';
import { LuEye, LuEyeOff } from 'react-icons/lu';

/**
 * Inline editable boolean (Ustym 2026-05-29). Used by the /soporte
 * admin inline CMS for the article `published` flag. One click flips
 * the value optimistically; rolls back on save failure.
 */
export function EditableToggle({
  slug,
  initialValue,
  isAdmin,
  labelOn,
  labelOff,
  onSave,
}: {
  slug: string;
  initialValue: boolean;
  isAdmin: boolean;
  labelOn: string;
  labelOff: string;
  onSave: (value: boolean) => Promise<{ ok: boolean; error?: string }>;
}): React.ReactElement | null {
  const [value, setValue] = useState(initialValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isAdmin) return null;

  const toggle = async (): Promise<void> => {
    const next = !value;
    setBusy(true);
    setError(null);
    setValue(next); // optimistic
    try {
      const result = await onSave(next);
      if (!result.ok) {
        setValue(!next); // rollback
        setError(result.error ?? 'No pudimos guardar.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={busy}
      data-testid={`editable-toggle-${slug}`}
      title={error ?? undefined}
      className={`inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium ring-1 ring-inset transition-colors disabled:opacity-60 cursor-pointer ${
        value
          ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100'
          : 'bg-zinc-100 text-zinc-600 ring-zinc-200 hover:bg-zinc-200'
      }`}
    >
      {value ? (
        <LuEye aria-hidden className="h-3.5 w-3.5" />
      ) : (
        <LuEyeOff aria-hidden className="h-3.5 w-3.5" />
      )}
      {value ? labelOn : labelOff}
    </button>
  );
}
