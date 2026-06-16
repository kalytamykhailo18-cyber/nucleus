'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LuX } from 'react-icons/lu';

/**
 * Generic modal shell — backdrop, card, close X, ESC + click-outside.
 *
 * Used by every create/edit/delete entry point in Nucleus. The modal
 * carries focus, traps it on its first child, restores focus to the
 * trigger when it closes. Body scroll is locked while open by default,
 * but pages where the modal sits over an interactive surface (e.g. the
 * geofence editor's map) can pass `lockBodyScroll={false}` plus
 * `dock="left"` so the user can still scroll the page underneath AND
 * see/click the map while editing.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  testId,
  size = 'md',
  lockBodyScroll = true,
  dock = 'center',
  cardClassName,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  testId?: string;
  size?: 'sm' | 'md' | 'lg';
  lockBodyScroll?: boolean;
  /**
   * Extra Tailwind classes appended to the card's className. Use it for
   * accent rings (e.g. `ring-2 ring-rose-300` on a destructive confirm)
   * so each modal consumer can flag its own tone without Modal needing
   * to know the semantic.
   */
  cardClassName?: string;
  /**
   * Where the modal card sits on screen.
   * - `center` (default): classic overlay with dim+blur backdrop, click-outside-to-close.
   * - `left`: docks to the left of the viewport on desktop, slides up as a
   *   bottom sheet on mobile. No backdrop dim. Pointer events fall through
   *   to whatever is behind the empty area, so an interactive surface (map,
   *   etc.) stays clickable. ESC, X, and Cancelar still close.
   */
  dock?: 'center' | 'left';
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  // Stash onClose in a ref so the open/close effect doesn't re-run on
  // every parent render. Callers routinely pass inline arrows; keeping
  // onClose in the dep array meant the cleanup fired on every keystroke
  // and yanked focus back to the trigger button.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  // The modal is portalled to document.body so its `position: fixed`
  // is never trapped by an ancestor with `transform`, `perspective`,
  // `filter`, or `will-change: transform` — those properties create a
  // new containing block for fixed-position descendants, and several
  // of our landing-page cards use transform-based rise / tilt
  // animations that would otherwise pin the modal inside the card.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', onKey);
    const original = document.body.style.overflow;
    if (lockBodyScroll) {
      document.body.style.overflow = 'hidden';
    }

    // Focus the first focusable element inside the modal so keyboard users
    // land somewhere sensible.
    const card = cardRef.current;
    if (card) {
      const focusable = card.querySelector<HTMLElement>(
        'input, select, textarea, button, [tabindex]:not([tabindex="-1"])',
      );
      focusable?.focus();
    }

    return () => {
      document.removeEventListener('keydown', onKey);
      if (lockBodyScroll) {
        document.body.style.overflow = original;
      }
      previousFocus.current?.focus?.();
    };
  }, [open, lockBodyScroll]);

  if (!open || !mounted) return null;

  const leftDockNode = (
    <div
      data-testid={testId}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="pointer-events-none fixed inset-0 z-[1000]"
    >
        <div
          ref={cardRef}
          className={`pointer-events-auto fixed inset-x-3 bottom-3 max-h-[80vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-[0_2px_4px_rgba(15,23,42,0.06),0_24px_60px_rgba(15,23,42,0.18)] animate-rise sm:inset-auto sm:left-6 sm:top-1/2 sm:max-h-[85vh] sm:w-[380px] sm:-translate-y-1/2 ${cardClassName ?? ''}`}
        >
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-base font-semibold tracking-tight text-zinc-900">
              {title}
            </h3>
            <button
              type="button"
              data-testid={testId ? `${testId}-close` : 'modal-close'}
              onClick={onClose}
              aria-label="Cerrar"
              className="-mr-2 -mt-2 inline-flex h-8 w-8 items-center justify-center rounded-full text-sky-500 transition-colors hover:bg-sky-50 hover:text-sky-700"
            >
              <LuX aria-hidden className="h-4 w-4 text-sky-500" />
            </button>
          </div>
          <div className="mt-4">{children}</div>
        </div>
      </div>
  );

  if (dock === 'left') {
    return createPortal(leftDockNode, document.body);
  }

  const widthClass =
    size === 'sm'
      ? 'max-w-sm'
      : size === 'lg'
        ? 'max-w-2xl'
        : 'max-w-md';

  const centerNode = (
    <div
      data-testid={testId}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto px-4 py-6 sm:items-center"
    >
      <div
        className="absolute inset-0 bg-zinc-900/30 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={cardRef}
        className={`relative w-full ${widthClass} max-h-[calc(100dvh-3rem)] overflow-y-auto rounded-3xl bg-white p-6 shadow-[0_2px_4px_rgba(15,23,42,0.06),0_24px_60px_rgba(15,23,42,0.18)] animate-rise ${cardClassName ?? ''}`}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold tracking-tight text-zinc-900">
            {title}
          </h3>
          <button
            type="button"
            data-testid={testId ? `${testId}-close` : 'modal-close'}
            onClick={onClose}
            aria-label="Cerrar"
            className="-mr-2 -mt-2 inline-flex h-8 w-8 items-center justify-center rounded-full text-sky-500 transition-colors hover:bg-sky-50 hover:text-sky-700"
          >
            <LuX aria-hidden className="h-4 w-4 text-sky-500" />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
  return createPortal(centerNode, document.body);
}
