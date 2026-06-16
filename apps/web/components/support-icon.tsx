import type { ComponentType, SVGProps } from 'react';
import {
  LuBatteryCharging,
  LuBellRing,
  LuBookOpen,
  LuHeart,
  LuLifeBuoy,
  LuMapPin,
  LuPhone,
  LuShield,
  LuVideo,
  LuWatch,
} from 'react-icons/lu';

/**
 * Maps a `SupportArticle.iconKey` (a stable string the admin picks from
 * a dropdown) onto a Lucide icon component and a semantic tone. Unknown
 * keys fall back to the open-book glyph + indigo tone so a typo never
 * breaks rendering. Tones come from the same palette as the section
 * labels and header tabs so the page reads as a coloured palette of
 * sections rather than a flat sensu wash.
 */
type IconEntry = {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  tone: SupportTone;
};

export type SupportTone =
  | 'sensu'
  | 'sky'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'violet'
  | 'indigo';

const ICON_MAP: Record<string, IconEntry> = {
  'book-open': { icon: LuBookOpen, tone: 'indigo' },
  'life-buoy': { icon: LuLifeBuoy, tone: 'rose' },
  'battery-charging': { icon: LuBatteryCharging, tone: 'emerald' },
  'bell-ring': { icon: LuBellRing, tone: 'amber' },
  'map-pin': { icon: LuMapPin, tone: 'sky' },
  phone: { icon: LuPhone, tone: 'violet' },
  heart: { icon: LuHeart, tone: 'rose' },
  shield: { icon: LuShield, tone: 'sensu' },
  video: { icon: LuVideo, tone: 'sky' },
  watch: { icon: LuWatch, tone: 'violet' },
};

export const SUPPORT_ICON_KEYS = Object.keys(ICON_MAP);

const FALLBACK: IconEntry = { icon: LuBookOpen, tone: 'indigo' };

/**
 * Background + foreground class pairs per tone. Background is the
 * tinted circle the icon sits in, foreground is the icon stroke.
 */
const TONE_CIRCLE: Record<SupportTone, { bg: string; fg: string }> = {
  sensu: { bg: 'bg-sensu-50', fg: 'text-sensu-600' },
  sky: { bg: 'bg-sky-50', fg: 'text-sky-600' },
  emerald: { bg: 'bg-emerald-50', fg: 'text-emerald-600' },
  amber: { bg: 'bg-amber-50', fg: 'text-amber-700' },
  rose: { bg: 'bg-rose-50', fg: 'text-rose-600' },
  violet: { bg: 'bg-violet-50', fg: 'text-violet-600' },
  indigo: { bg: 'bg-indigo-50', fg: 'text-indigo-600' },
};

export function getSupportIconTone(iconKey: string): SupportTone {
  return (ICON_MAP[iconKey] ?? FALLBACK).tone;
}

export function getSupportIconCircleClasses(iconKey: string): {
  bg: string;
  fg: string;
} {
  return TONE_CIRCLE[getSupportIconTone(iconKey)];
}

export function SupportIcon({
  iconKey,
  className,
}: {
  iconKey: string;
  className?: string;
}): React.ReactElement {
  const Icon = (ICON_MAP[iconKey] ?? FALLBACK).icon;
  return <Icon aria-hidden className={className} />;
}
