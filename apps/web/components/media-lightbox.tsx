'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { LuPlay, LuX, LuZoomIn } from 'react-icons/lu';

/**
 * Thumbnail + lightbox combo for /soporte articles.
 *
 * The article card renders a small clickable thumbnail (image or video
 * poster). Clicking opens a full-viewport overlay with the media at its
 * natural maximum size — image stretches to fit the viewport, video
 * plays back with native controls (or an iframe for YouTube/Vimeo
 * URLs). ESC, the X button, or a click on the dark backdrop closes.
 *
 * The lightbox is portaled into document.body to escape any
 * backdrop-filter stacking context above the article card.
 */

function isEmbeddable(url: string): boolean {
  return /(?:youtube\.com|youtu\.be|vimeo\.com|player\.vimeo)/i.test(url);
}

function toEmbedSrc(url: string): string {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?autoplay=1`;
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}?autoplay=1`;
  return url;
}

export function MediaLightbox({
  imageUrl,
  videoUrl,
  title,
  testId,
}: {
  imageUrl: string | null;
  videoUrl: string | null;
  title: string;
  testId: string;
}): React.ReactElement | null {
  const [open, setOpen] = useState<null | 'image' | 'video'>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(null);
      }
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!imageUrl && !videoUrl) return null;

  const close = (): void => setOpen(null);

  return (
    <div
      data-testid={`${testId}-media`}
      className="flex flex-col items-stretch gap-3"
    >
      {imageUrl ? (
        <button
          type="button"
          data-testid={`${testId}-image-thumb`}
          onClick={() => setOpen('image')}
          aria-label={`Ampliar imagen: ${title}`}
          className="group relative inline-flex aspect-[4/3] w-full overflow-hidden rounded-2xl ring-1 ring-zinc-200 transition-transform hover:-translate-y-0.5 cursor-pointer"
        >
          <img
            src={imageUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
          <span
            aria-hidden
            className="absolute inset-0 flex items-center justify-center bg-zinc-900/0 text-white opacity-0 transition-all group-hover:bg-zinc-900/30 group-hover:opacity-100"
          >
            <LuZoomIn className="h-5 w-5" />
          </span>
        </button>
      ) : null}

      {videoUrl ? (
        <button
          type="button"
          data-testid={`${testId}-video-thumb`}
          onClick={() => setOpen('video')}
          aria-label={`Reproducir video: ${title}`}
          className="group relative inline-flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-2xl bg-zinc-900 text-white ring-1 ring-zinc-200 transition-transform hover:-translate-y-0.5 cursor-pointer"
        >
          <span
            aria-hidden
            className="absolute inset-0 bg-gradient-to-br from-zinc-700/40 to-zinc-900/80"
          />
          <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-white/95 text-zinc-900 shadow-[0_2px_8px_rgba(0,0,0,0.25)] transition-transform group-hover:scale-110">
            <LuPlay className="h-5 w-5" />
          </span>
        </button>
      ) : null}

      {open && mounted
        ? createPortal(
            <Overlay
              kind={open}
              imageUrl={imageUrl}
              videoUrl={videoUrl}
              title={title}
              onClose={close}
              testId={testId}
            />,
            document.body,
          )
        : null}
    </div>
  );
}

function Overlay({
  kind,
  imageUrl,
  videoUrl,
  title,
  onClose,
  testId,
}: {
  kind: 'image' | 'video';
  imageUrl: string | null;
  videoUrl: string | null;
  title: string;
  onClose: () => void;
  testId: string;
}): React.ReactElement {
  return (
    <div
      data-testid={`${testId}-lightbox`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[1100] flex items-center justify-center p-4 sm:p-8"
    >
      <div
        aria-hidden
        onClick={onClose}
        className="absolute inset-0 bg-zinc-950/85 backdrop-blur-sm"
      />
      <button
        type="button"
        data-testid={`${testId}-lightbox-close`}
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25 cursor-pointer"
      >
        <LuX aria-hidden className="h-5 w-5" />
      </button>

      {kind === 'image' && imageUrl ? (
        <img
          src={imageUrl}
          alt={title}
          data-testid={`${testId}-lightbox-image`}
          className="relative max-h-[88vh] max-w-[92vw] rounded-2xl object-contain shadow-[0_24px_60px_rgba(0,0,0,0.5)]"
        />
      ) : null}

      {kind === 'video' && videoUrl ? (
        isEmbeddable(videoUrl) ? (
          <iframe
            src={toEmbedSrc(videoUrl)}
            data-testid={`${testId}-lightbox-iframe`}
            title={title}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            className="relative aspect-video w-[92vw] max-w-5xl rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.5)]"
          />
        ) : (
          <video
            src={videoUrl}
            data-testid={`${testId}-lightbox-video`}
            controls
            autoPlay
            className="relative max-h-[88vh] max-w-[92vw] rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.5)]"
          />
        )
      ) : null}
    </div>
  );
}
