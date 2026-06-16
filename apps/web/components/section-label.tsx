import type { ReactNode, ComponentType, SVGProps } from 'react';

/**
 * Small uppercase eyebrow that introduces a section. The icon to the left
 * picks a semantic tone — destructive=rose, brand=sensu, info=sky,
 * active=emerald, attention=amber, future/idea=violet — chosen by the
 * caller per section meaning, so the page reads as a palette of
 * differentiated sections rather than a single sensu wash.
 */

export type SectionTone =
  | 'sensu'
  | 'sky'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'violet'
  | 'indigo';

const TONE: Record<SectionTone, string> = {
  sensu: 'text-sensu-500',
  sky: 'text-sky-500',
  emerald: 'text-emerald-500',
  amber: 'text-amber-500',
  rose: 'text-rose-500',
  violet: 'text-violet-500',
  indigo: 'text-indigo-500',
};

export function SectionLabel({
  icon: Icon,
  children,
  testId,
  tone = 'sensu',
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  children: ReactNode;
  testId?: string;
  tone?: SectionTone;
}) {
  return (
    <p
      data-testid={testId}
      className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500"
    >
      <Icon aria-hidden className={`h-4 w-4 ${TONE[tone]}`} />
      <span>{children}</span>
    </p>
  );
}
