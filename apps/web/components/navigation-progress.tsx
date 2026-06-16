'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * Thin top-of-viewport progress bar that fires the moment the user
 * clicks an internal link and retreats when the new route commits.
 *
 * Why: Next's App Router transitions feel silent — a click on the
 * header dropdown or sidebar offered no acknowledgement until the
 * destination paint landed, so users second-guessed their click and
 * tapped again. The bar provides the missing affordance without
 * touching individual <Link>s; we attach one document-level click
 * listener and let usePathname/useSearchParams tell us when the
 * transition finishes.
 */
export function NavigationProgress(): React.ReactElement | null {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hide on every route commit (pathname or query change).
  useEffect(() => {
    if (!active) return;
    setProgress(100);
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setActive(false);
      setProgress(0);
    }, 220);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  // Intercept clicks on any internal anchor so Link/<a href="/...">
  // both light up the bar. We bail on new-tab/modifier/external/hash
  // navigations because the browser handles those without a SPA
  // transition.
  useEffect(() => {
    function onClick(e: MouseEvent): void {
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest('a');
      if (!anchor) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;
      const href = anchor.getAttribute('href');
      if (!href) return;
      if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      // Same URL — no commit will fire, so the bar would hang.
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return;
      }
      start();
    }
    document.addEventListener('click', onClick, { capture: true });
    return () => document.removeEventListener('click', onClick, { capture: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function start(): void {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    setActive(true);
    setProgress(15);
    if (tickRef.current) clearInterval(tickRef.current);
    // Ease toward 90% so the bar always feels alive even if the
    // navigation takes a beat. The route-commit effect snaps it to
    // 100 and unmounts.
    tickRef.current = setInterval(() => {
      setProgress((p) => (p < 90 ? p + Math.max((90 - p) * 0.08, 0.5) : p));
    }, 120);
  }

  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  if (!active) return null;

  return (
    <div
      data-testid="navigation-progress"
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[2000] h-0.5"
    >
      <div
        className="h-full bg-sensu-500 shadow-[0_0_8px_rgba(2,132,199,0.6)] transition-[width,opacity] duration-200 ease-out"
        style={{
          width: `${progress}%`,
          opacity: progress >= 100 ? 0 : 1,
        }}
      />
    </div>
  );
}
