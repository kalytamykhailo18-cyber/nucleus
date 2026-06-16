import type { ReactElement } from 'react';

/**
 * User avatar primitive. Renders the supplied image URL when present;
 * otherwise renders the user's initials in a coloured circle keyed to
 * the name (deterministic per user, so the same person always gets
 * the same tone across surfaces).
 */

const TONES: Array<{ bg: string; fg: string }> = [
  { bg: 'bg-sky-100', fg: 'text-sky-700' },
  { bg: 'bg-emerald-100', fg: 'text-emerald-700' },
  { bg: 'bg-amber-100', fg: 'text-amber-700' },
  { bg: 'bg-rose-100', fg: 'text-rose-700' },
  { bg: 'bg-violet-100', fg: 'text-violet-700' },
  { bg: 'bg-indigo-100', fg: 'text-indigo-700' },
  { bg: 'bg-sensu-100', fg: 'text-sensu-700' },
];

function pickTone(seed: string): { bg: string; fg: string } {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return TONES[h % TONES.length];
}

function initialsFrom(name: string | null, email: string | null): string {
  const source = (name && name.trim()) || (email && email.split('@')[0]) || '';
  const parts = source.replace(/[._-]+/g, ' ').split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

const SIZE_CLASS: Record<NonNullable<AvatarProps['size']>, string> = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-16 w-16 text-lg',
  xl: 'h-24 w-24 text-2xl',
};

type AvatarProps = {
  src?: string | null;
  name?: string | null;
  email?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  testId?: string;
};

export function Avatar({
  src,
  name,
  email,
  size = 'md',
  className,
  testId,
}: AvatarProps): ReactElement {
  const sizeCls = SIZE_CLASS[size];
  if (src) {
    return (
      <img
        src={src}
        alt=""
        data-testid={testId}
        className={`inline-block ${sizeCls} shrink-0 rounded-full object-cover ring-1 ring-zinc-200/70 ${className ?? ''}`}
      />
    );
  }
  const tone = pickTone((name ?? email ?? 'sensu').toLowerCase());
  const initials = initialsFrom(name ?? null, email ?? null);
  return (
    <span
      aria-hidden
      data-testid={testId}
      className={`inline-flex ${sizeCls} shrink-0 items-center justify-center rounded-full font-semibold ${tone.bg} ${tone.fg} ${className ?? ''}`}
    >
      {initials}
    </span>
  );
}
