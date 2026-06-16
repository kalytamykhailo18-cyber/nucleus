/**
 * Inline marketing video player for landing-page sections.
 *
 * Auto-detects the URL format and embeds accordingly:
 *   - YouTube (watch / youtu.be / shorts) → /embed/{id} iframe with
 *     autoplay + mute + loop + playsinline; tag-loop only fires when
 *     `playlist={id}` is passed alongside.
 *   - Vimeo → player.vimeo.com iframe with autoplay + muted + loop.
 *   - Anything else (Cloudinary /video/upload, direct mp4/webm/mov) →
 *     native <video> element with autoplay + muted + loop + playsInline.
 *
 * Defaults to "moving wallpaper" behaviour (no controls visible) so the
 * hero feels alive without demanding attention. Pass `controls` when an
 * admin wants a tap-to-play surface (e.g. testimonial review videos).
 *
 * The 16:9 aspect is enforced by the wrapper so the iframe never
 * letterboxes the viewport on YouTube Shorts (which are 9:16) — the
 * caller can override with `aspectClass`.
 */

const YT_RE = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/;
const VIMEO_RE = /vimeo\.com\/(?:video\/)?(\d+)/;
const CLOUDINARY_VIDEO_RE = /res\.cloudinary\.com\/([^/]+)\/video\/upload\/(?:[^/]+\/)?(v\d+\/)?([^.?]+)\.[a-z0-9]+/i;

/**
 * Derive a static first-frame poster URL for a video so the hero is
 * never visually empty before metadata loads (or when autoplay is
 * denied — Playwright headless, low-power mobile, prefers-reduced-motion).
 * For Cloudinary /video/upload URLs we rewrite to a jpg derivative;
 * for YouTube we use the default 'hqdefault' thumbnail; otherwise null.
 */
function posterFor(url: string): string | null {
  const yt = url.match(YT_RE);
  if (yt) return `https://i.ytimg.com/vi/${yt[1]}/hqdefault.jpg`;
  const cld = url.match(CLOUDINARY_VIDEO_RE);
  if (cld) {
    const cloud = cld[1];
    const version = cld[2] ?? '';
    const publicId = cld[3];
    return `https://res.cloudinary.com/${cloud}/video/upload/so_0,f_jpg,q_auto/${version}${publicId}.jpg`;
  }
  return null;
}

function youtubeEmbedSrc(id: string, controls: boolean): string {
  const params = new URLSearchParams({
    autoplay: '1',
    mute: '1',
    loop: '1',
    playlist: id, // required for loop=1 to actually loop a single video
    playsinline: '1',
    rel: '0',
    modestbranding: '1',
    controls: controls ? '1' : '0',
  });
  // youtube-nocookie.com bypasses the "Sign in to confirm you're not a
  // bot" interstitial that youtube.com/embed/ now shows in headless and
  // data-center contexts. Same player, no tracking cookies until first
  // interaction. This is the domain the prior Lovable site used.
  return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`;
}

function vimeoEmbedSrc(id: string): string {
  const params = new URLSearchParams({
    autoplay: '1',
    muted: '1',
    loop: '1',
    background: '1',
  });
  return `https://player.vimeo.com/video/${id}?${params.toString()}`;
}

export function LandingVideo({
  url,
  title,
  controls = false,
  aspectClass = 'aspect-video',
  className,
  testId,
}: {
  url: string;
  /** Accessible title for screen readers + YouTube iframe. */
  title: string;
  /** Show native player controls. Default false for "moving wallpaper". */
  controls?: boolean;
  /** Tailwind aspect-ratio class. Default 16:9. */
  aspectClass?: string;
  /** Extra classes appended to the wrapper. */
  className?: string;
  testId?: string;
}): React.ReactElement {
  const yt = url.match(YT_RE);
  const vimeo = !yt ? url.match(VIMEO_RE) : null;
  const isEmbed = !!yt || !!vimeo;

  return (
    <div
      data-testid={testId}
      className={`relative w-full overflow-hidden rounded-3xl ring-1 ring-zinc-200 shadow-[0_20px_50px_rgba(15,23,42,0.18)] ${aspectClass} ${className ?? ''}`}
    >
      {yt ? (
        <iframe
          src={youtubeEmbedSrc(yt[1]!, controls)}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      ) : vimeo ? (
        <iframe
          src={vimeoEmbedSrc(vimeo[1]!)}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      ) : (
        <video
          src={url}
          // poster is derived from the URL so the first-frame thumbnail
          // shows immediately even before video metadata arrives — keeps
          // the hero from rendering as an empty rounded rectangle in any
          // environment where autoplay is denied or data is still in
          // flight (Playwright headless, low-power mobile, reduced-motion).
          poster={posterFor(url) ?? undefined}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          controls={controls}
          aria-label={title}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      {/* The `data-testid="-source"` is harmless for the iframe case and
          gives Playwright a deterministic locator when admins swap videos
          via the inline CMS. */}
      {!isEmbed ? null : (
        <span
          data-testid={testId ? `${testId}-source` : undefined}
          className="sr-only"
        >
          {url}
        </span>
      )}
    </div>
  );
}
