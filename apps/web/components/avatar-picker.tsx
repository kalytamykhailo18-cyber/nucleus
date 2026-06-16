'use client';

import { useRef, useState } from 'react';
import { LuTrash2, LuUpload } from 'react-icons/lu';
import { Avatar } from './avatar';

/**
 * File-pick → server upload → onChange(url). Used on /profile so the
 * family can upload an avatar.
 *
 * The picker uploads through /api/profile/avatar, which signs and
 * forwards the file to Cloudinary, then returns the secure_url. The
 * profile form persists that URL on the next save (PATCH /api/auth/me
 * with `profileImageUrl`). The DB only ever stores the link — never
 * the bytes — so the User row stays small no matter how big the
 * source image is.
 *
 * Hard cap is 8 MB (Cloudinary serves resized variants from there).
 * Anything bigger is rejected before it leaves the browser.
 */

const MAX_BYTES = 8 * 1024 * 1024;

export function AvatarPicker({
  value,
  name,
  email,
  onChange,
}: {
  value: string | null;
  name: string | null;
  email: string | null;
  onChange: (next: string | null) => void;
}): React.ReactElement {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pick = (): void => inputRef.current?.click();

  const onFile = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = e.target.files?.[0] ?? null;
    e.target.value = '';
    if (!file) return;
    setError(null);
    if (!file.type.startsWith('image/')) {
      setError('El archivo debe ser una imagen.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(
        `La imagen pesa demasiado. Máximo ${Math.round(
          MAX_BYTES / 1024 / 1024,
        )} MB; sube una versión más pequeña.`,
      );
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.set('file', file);
      const res = await fetch('/api/profile/avatar', {
        method: 'POST',
        body: form,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(body.error ?? 'No se pudo subir la imagen.');
        return;
      }
      const { url } = (await res.json()) as { url: string };
      onChange(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de red');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <Avatar
        src={value}
        name={name}
        email={email}
        size="xl"
        testId="profile-avatar"
      />
      <div className="flex flex-col gap-2">
        <button
          type="button"
          data-testid="profile-avatar-upload"
          onClick={pick}
          disabled={busy}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-sensu-50 px-3 text-sm font-medium tracking-tight text-sensu-700 transition-colors hover:bg-sensu-100 disabled:opacity-50 cursor-pointer"
        >
          <LuUpload aria-hidden className="h-4 w-4" />
          {busy ? 'Subiendo…' : value ? 'Cambiar foto' : 'Subir foto'}
        </button>
        {value ? (
          <button
            type="button"
            data-testid="profile-avatar-clear"
            onClick={() => onChange(null)}
            disabled={busy}
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium tracking-tight text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50 cursor-pointer"
          >
            <LuTrash2 aria-hidden className="h-4 w-4" />
            Quitar foto
          </button>
        ) : null}
        {error ? (
          <p
            data-testid="profile-avatar-error"
            className="text-xs text-rose-700"
          >
            {error}
          </p>
        ) : null}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          data-testid="profile-avatar-input"
          onChange={onFile}
          className="sr-only"
        />
      </div>
    </div>
  );
}
