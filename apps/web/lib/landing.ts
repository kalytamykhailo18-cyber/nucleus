import { prisma } from '@/lib/db';

/**
 * Inline landing CMS helpers (Ustym 2026-05-28).
 *
 * The marketing site renders from JSX defaults shipped in source so
 * the page works the day Nucleus deploys, even before any admin
 * edits. When a `LandingItem` row exists for a given slug, its
 * content overrides the default at render time. Components fetch a
 * single map per request via `fetchLandingOverrides()` and call
 * `pickText` / `pickImage` to merge in their own defaults.
 */

export type LandingTextContent = { text: string };
export type LandingImageContent = {
  url: string;
  alt?: string | null;
};
export type LandingVideoContent = {
  /**
   * Video source URL. Renderer detects format and embeds accordingly:
   *   - YouTube watch / youtu.be / shorts → /embed/{id} iframe
   *   - Vimeo → player.vimeo.com iframe
   *   - Direct mp4/webm/mov → <video> tag with native controls
   *   - Cloudinary /video/upload/* → <video> tag
   */
  url: string;
};

export type LandingOverrideMap = Map<
  string,
  | { kind: 'TEXT'; content: LandingTextContent }
  | { kind: 'IMAGE'; content: LandingImageContent }
  | { kind: 'VIDEO'; content: LandingVideoContent }
>;

export async function fetchLandingOverrides(): Promise<LandingOverrideMap> {
  const rows = await prisma.landingItem.findMany();
  const map: LandingOverrideMap = new Map();
  for (const r of rows) {
    if (r.kind === 'TEXT') {
      const c = r.content as unknown as LandingTextContent;
      if (typeof c?.text === 'string') {
        map.set(r.slug, { kind: 'TEXT', content: { text: c.text } });
      }
    } else if (r.kind === 'IMAGE') {
      const c = r.content as unknown as LandingImageContent;
      if (typeof c?.url === 'string') {
        map.set(r.slug, {
          kind: 'IMAGE',
          content: { url: c.url, alt: c.alt ?? null },
        });
      }
    } else if (r.kind === 'VIDEO') {
      const c = r.content as unknown as LandingVideoContent;
      if (typeof c?.url === 'string') {
        map.set(r.slug, {
          kind: 'VIDEO',
          content: { url: c.url },
        });
      }
    }
  }
  return map;
}

export function pickText(
  overrides: LandingOverrideMap,
  slug: string,
  fallback: string,
): string {
  const o = overrides.get(slug);
  if (o?.kind === 'TEXT') return o.content.text;
  return fallback;
}

export function pickImage(
  overrides: LandingOverrideMap,
  slug: string,
  fallback: { url: string; alt?: string },
): { url: string; alt: string } {
  const o = overrides.get(slug);
  if (o?.kind === 'IMAGE') {
    return { url: o.content.url, alt: o.content.alt ?? fallback.alt ?? '' };
  }
  return { url: fallback.url, alt: fallback.alt ?? '' };
}

export function pickVideo(
  overrides: LandingOverrideMap,
  slug: string,
  fallback: { url: string },
): { url: string } {
  const o = overrides.get(slug);
  if (o?.kind === 'VIDEO') return { url: o.content.url };
  return { url: fallback.url };
}
