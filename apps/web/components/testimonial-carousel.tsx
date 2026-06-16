'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { LuChevronLeft, LuChevronRight, LuPencil, LuQuote } from 'react-icons/lu';
import {
  TestimonialEditModal,
  type TestimonialEditDraft,
} from './testimonial-edit-modal';

export type Testimonial = {
  slug: string;
  quote: string;
  name: string;
  relation: string;
  photo: string;
};

type Props = {
  items: Testimonial[];
  autoAdvanceMs?: number;
  isAdmin?: boolean;
};

const DEFAULT_AUTO_ADVANCE_MS = 5500;
const DRAG_THRESHOLD_PX = 60;
const TILT_MAX_DEG = 6;

export function TestimonialCarousel({
  items: initialItems,
  autoAdvanceMs = DEFAULT_AUTO_ADVANCE_MS,
  isAdmin = false,
}: Props) {
  const [items, setItems] = useState<Testimonial[]>(initialItems);
  const count = items.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const [editingSlug, setEditingSlug] = useState<string | null>(null);

  const saveTestimonial = useCallback(
    async (slug: string, draft: TestimonialEditDraft) => {
      const patches: Array<Promise<Response>> = [
        ['quote', { kind: 'TEXT', content: { text: draft.quote } }],
        ['name', { kind: 'TEXT', content: { text: draft.name } }],
        ['relation', { kind: 'TEXT', content: { text: draft.relation } }],
        [
          'photo',
          { kind: 'IMAGE', content: { url: draft.photoUrl, alt: draft.name } },
        ],
      ].map(([field, body]) =>
        fetch(`/api/admin/landing/${slug}-${field as string}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        }),
      );
      const results = await Promise.all(patches);
      if (results.some((r) => !r.ok)) {
        return { ok: false as const, error: 'No pudimos guardar todos los campos.' };
      }
      setItems((cur) =>
        cur.map((it) =>
          it.slug === slug
            ? {
                ...it,
                quote: draft.quote,
                name: draft.name,
                relation: draft.relation,
                photo: draft.photoUrl,
              }
            : it,
        ),
      );
      return { ok: true as const };
    },
    [],
  );

  const viewportRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; pointerId: number } | null>(null);
  const dragMoved = useRef(false);

  const goTo = useCallback(
    (next: number) => {
      setIndex(((next % count) + count) % count);
    },
    [count],
  );
  const goPrev = useCallback(() => goTo(index - 1), [goTo, index]);
  const goNext = useCallback(() => goTo(index + 1), [goTo, index]);

  useEffect(() => {
    if (paused || count <= 1) return;
    const t = setInterval(() => {
      setIndex((i) => (i + 1) % count);
    }, autoAdvanceMs);
    return () => clearInterval(t);
  }, [paused, count, autoAdvanceMs]);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    // Admins drive the inline CMS — eye candy (3D tilt + drag swipe)
    // gets in the way of the pencil click, so we skip the whole
    // drag-tracking pipeline for them. Visitors still get the
    // immersive interaction.
    if (isAdmin) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Bail out if the user is clicking an interactive control inside
    // a slide (pencil button, input, link, etc.). Without this,
    // setPointerCapture can route the follow-up click to the
    // viewport instead of the button.
    const target = e.target as HTMLElement | null;
    if (
      target &&
      target.closest('button, input, textarea, a, [role="button"]')
    ) {
      return;
    }
    dragStart.current = { x: e.clientX, pointerId: e.pointerId };
    dragMoved.current = false;
    setPaused(true);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (isAdmin) return;
    const start = dragStart.current;
    if (!start) {
      const node = viewportRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / Math.max(rect.width, 1);
      const dy = (e.clientY - cy) / Math.max(rect.height, 1);
      const ry = Math.max(-TILT_MAX_DEG, Math.min(TILT_MAX_DEG, dx * TILT_MAX_DEG * 2));
      const rx = Math.max(-TILT_MAX_DEG, Math.min(TILT_MAX_DEG, -dy * TILT_MAX_DEG * 2));
      setTilt({ rx, ry });
      return;
    }
    const delta = e.clientX - start.x;
    if (Math.abs(delta) > 4) dragMoved.current = true;
    setDragOffset(delta);
  }
  function endDrag(e: React.PointerEvent<HTMLDivElement>) {
    const start = dragStart.current;
    if (!start) return;
    const delta = dragOffset;
    dragStart.current = null;
    setDragOffset(0);
    setPaused(false);
    (e.currentTarget as HTMLElement).releasePointerCapture?.(start.pointerId);
    if (delta > DRAG_THRESHOLD_PX) goPrev();
    else if (delta < -DRAG_THRESHOLD_PX) goNext();
  }

  function onPointerLeave() {
    setTilt({ rx: 0, ry: 0 });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
    }
    const node = viewportRef.current;
    if (!node) return;
    node.addEventListener('keydown', onKey as EventListener);
    return () => node.removeEventListener('keydown', onKey as EventListener);
  }, [goPrev, goNext]);

  const trackTransform = `translate3d(calc(${-index * 100}% + ${dragOffset}px), 0, 0)`;

  return (
    <div
      className="relative mt-10"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => {
        setPaused(false);
        setTilt({ rx: 0, ry: 0 });
      }}
    >
      <div
        ref={viewportRef}
        data-testid="testimonial-carousel-viewport"
        tabIndex={0}
        role="region"
        aria-roledescription="carousel"
        aria-label="Testimonios de familias"
        className="overflow-hidden rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-sensu-300"
        style={{ perspective: '1600px', touchAction: 'pan-y' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={onPointerLeave}
      >
        <ul
          className="flex"
          style={{
            transform: trackTransform,
            transition: dragStart.current
              ? 'none'
              : 'transform 520ms cubic-bezier(0.32, 0.72, 0, 1)',
          }}
        >
          {items.map((t, i) => {
            const isActive = i === index;
            return (
              <li
                key={t.slug}
                aria-hidden={!isActive}
                aria-roledescription="slide"
                className="min-w-full px-2 sm:px-4"
                style={{ transformStyle: 'preserve-3d' }}
              >
                <article
                  data-testid={`testimonial-${t.slug}`}
                  className="card-surface relative mx-auto flex max-w-2xl flex-col gap-5 rounded-3xl p-7 sm:p-10"
                  style={{
                    transform: isActive
                      ? `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`
                      : 'rotateX(0deg) rotateY(0deg)',
                    transition: 'transform 220ms cubic-bezier(0.32, 0.72, 0, 1)',
                    transformStyle: 'preserve-3d',
                    willChange: 'transform',
                  }}
                >
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setEditingSlug(t.slug)}
                      onPointerDown={(e) => e.stopPropagation()}
                      data-testid={`testimonial-${t.slug}-edit`}
                      aria-label={`Editar testimonio de ${t.name}`}
                      title="Editar testimonio"
                      className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-sensu-600 opacity-80 shadow-sm ring-1 ring-inset ring-sensu-200 transition-opacity hover:opacity-100 cursor-pointer"
                    >
                      <LuPencil aria-hidden className="h-4 w-4" />
                    </button>
                  )}
                  <LuQuote aria-hidden className="h-7 w-7 text-sensu-500" />
                  <p
                    data-testid={`testimonial-${t.slug}-quote`}
                    className="text-base sm:text-lg leading-relaxed text-zinc-700"
                  >
                    {t.quote}
                  </p>
                  <div className="mt-2 flex items-center gap-4 pt-2">
                    <img
                      src={t.photo}
                      alt={t.name}
                      loading="lazy"
                      draggable={false}
                      className="h-14 w-14 rounded-full object-cover ring-1 ring-zinc-100"
                    />
                    <div>
                      <p
                        data-testid={`testimonial-${t.slug}-name`}
                        className="text-sm font-medium tracking-tight text-zinc-900"
                      >
                        {t.name}
                      </p>
                      <p
                        data-testid={`testimonial-${t.slug}-relation`}
                        className="text-xs text-zinc-500"
                      >
                        {t.relation}
                      </p>
                    </div>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center justify-between px-1 sm:px-2">
        <button
          type="button"
          aria-label="Testimonio anterior"
          data-testid="testimonial-prev"
          onClick={goPrev}
          className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-zinc-700 shadow-[0_8px_24px_rgba(15,23,42,0.12)] ring-1 ring-zinc-100 transition-transform hover:-translate-x-0.5 hover:text-sensu-600"
        >
          <LuChevronLeft aria-hidden className="h-5 w-5" />
        </button>
        <button
          type="button"
          aria-label="Siguiente testimonio"
          data-testid="testimonial-next"
          onClick={goNext}
          className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-zinc-700 shadow-[0_8px_24px_rgba(15,23,42,0.12)] ring-1 ring-zinc-100 transition-transform hover:translate-x-0.5 hover:text-sensu-600"
        >
          <LuChevronRight aria-hidden className="h-5 w-5" />
        </button>
      </div>

      {isAdmin && editingSlug && (() => {
        const target = items.find((it) => it.slug === editingSlug);
        if (!target) return null;
        return (
          <TestimonialEditModal
            open
            slugBase={target.slug}
            initial={{
              quote: target.quote,
              name: target.name,
              relation: target.relation,
              photoUrl: target.photo,
            }}
            onCancel={() => setEditingSlug(null)}
            onSave={(draft) => saveTestimonial(target.slug, draft)}
          />
        );
      })()}

      <ol className="mt-6 flex items-center justify-center gap-2">
        {items.map((t, i) => {
          const isActive = i === index;
          return (
            <li key={t.slug}>
              <button
                type="button"
                aria-label={`Ir al testimonio ${i + 1}`}
                aria-current={isActive ? 'true' : undefined}
                onClick={() => goTo(i)}
                className={`h-2 rounded-full transition-all ${
                  isActive
                    ? 'w-6 bg-sensu-500'
                    : 'w-2 bg-zinc-300 hover:bg-zinc-400'
                }`}
              />
            </li>
          );
        })}
      </ol>
    </div>
  );
}
