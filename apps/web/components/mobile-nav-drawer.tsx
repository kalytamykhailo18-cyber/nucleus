'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  LuChevronDown,
  LuLogOut,
  LuMenu,
  LuShield,
  LuX,
} from 'react-icons/lu';

/**
 * Mobile-only navigation drawer.
 *
 * On viewports below `sm`, the inline tab row in <AppHeader> is hidden
 * (it cramps and overlaps action surfaces). This component renders a
 * single hamburger trigger at the left of the header that slides a
 * full-height drawer in from the left with the same nav items rendered
 * as a vertical list with full labels. ESC and the backdrop close it.
 *
 * Items can carry `subItems`; when present, the row renders a chevron
 * affordance, tapping expands a nested list directly inside the
 * drawer (e.g. /soporte sections under the "Ayuda" row).
 *
 * The drawer panel is portaled into <body> so it isn't trapped inside
 * <AppHeader>'s backdrop-filter stacking context (that context makes
 * `position: fixed` resolve against the header, not the viewport).
 *
 * On `sm+`, the trigger is hidden entirely — desktop / tablet keep the
 * inline tab row in the header.
 */

export type MobileNavSubItem = {
  href: string;
  label: string;
  testId: string;
  iconNode?: React.ReactNode;
};

export type MobileNavItem = {
  href: string;
  label: string;
  testId: string;
  /** Rendered as JSX so server components can pass icons across the boundary. */
  iconNode: React.ReactNode;
  /** Optional tone for the divider grouping (admin items get their own group). */
  group?: 'primary' | 'admin' | 'attention';
  /** Optional nested list. When present, the row expands to reveal these. */
  subItems?: MobileNavSubItem[];
};

type Group = {
  key: 'attention' | 'primary' | 'admin';
  items: MobileNavItem[];
};

export function MobileNavDrawer({
  items,
  showLogout,
}: {
  items: MobileNavItem[];
  showLogout: boolean;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname() ?? '/';

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = original;
    };
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Active-state — only ONE href highlights at a time. We score every
  // candidate by prefix-match length and pick the longest. Without this
  // both `/profile` and `/profile/referrals` would light up when the
  // user is on the sub-route (Juan caught this in the screenshot
  // 2026-06-16).
  const bestMatch = (() => {
    let best: { href: string; length: number } | null = null;
    for (const it of items) {
      if (pathname === it.href || pathname.startsWith(`${it.href}/`)) {
        if (!best || it.href.length > best.length) {
          best = { href: it.href, length: it.href.length };
        }
      }
    }
    return best?.href ?? null;
  })();
  const isActive = (href: string): boolean => href === bestMatch;

  const groups: Group[] = [];
  for (const key of ['attention', 'primary', 'admin'] as const) {
    const groupItems = items.filter((i) => (i.group ?? 'primary') === key);
    if (groupItems.length > 0) groups.push({ key, items: groupItems });
  }

  return (
    <>
      <button
        type="button"
        data-testid="mobile-nav-trigger"
        aria-label="Abrir menú"
        aria-expanded={open}
        aria-controls="mobile-nav-drawer"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-700 transition-colors hover:bg-zinc-100/70 cursor-pointer min-[960px]:hidden"
      >
        <LuMenu aria-hidden className="h-5 w-5" />
      </button>

      {open && mounted
        ? createPortal(
            <DrawerPanel
              showLogout={showLogout}
              isActive={isActive}
              groups={groups}
              onClose={() => setOpen(false)}
            />,
            document.body,
          )
        : null}
    </>
  );
}

function DrawerPanel({
  showLogout,
  isActive,
  groups,
  onClose,
}: {
  showLogout: boolean;
  isActive: (href: string) => boolean;
  groups: Group[];
  onClose: () => void;
}): React.ReactElement {
  return (
    <div
      data-testid="mobile-nav-drawer"
      id="mobile-nav-drawer"
      role="dialog"
      aria-modal="true"
      aria-label="Menú principal"
      className="fixed inset-0 z-[1000] min-[960px]:hidden"
    >
      <div
        aria-hidden
        onClick={onClose}
        className="absolute inset-0 bg-zinc-900/30 backdrop-blur-sm"
      />
      <aside className="absolute inset-y-0 left-0 flex w-[78vw] max-w-[320px] flex-col bg-white shadow-[0_0_24px_rgba(15,23,42,0.18)] animate-slide-right">
        <header className="flex items-center justify-between gap-3 border-b border-zinc-200/70 px-5 py-4">
          <span className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
            <LuShield aria-hidden className="h-4 w-4 text-sensu-500" />
            <span className="font-semibold text-zinc-700">Sensu</span>
          </span>
          <button
            type="button"
            data-testid="mobile-nav-close"
            onClick={onClose}
            aria-label="Cerrar menú"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-sky-600 transition-colors hover:bg-sky-50 cursor-pointer"
          >
            <LuX aria-hidden className="h-4 w-4" />
          </button>
        </header>

        <nav
          aria-label="Navegación móvil"
          className="flex-1 overflow-y-auto px-3 py-4"
        >
          {groups.map((g, gi) => (
            <ul
              key={g.key}
              data-testid={`mobile-nav-group-${g.key}`}
              className={
                gi === 0
                  ? 'space-y-1'
                  : 'mt-3 space-y-1 border-t border-zinc-200/70 pt-3'
              }
            >
              {g.items.map((item) => (
                <NavRow
                  key={item.href}
                  item={item}
                  isActive={isActive}
                  onSelect={onClose}
                />
              ))}
            </ul>
          ))}
        </nav>

        {showLogout ? (
          <footer className="border-t border-zinc-200/70 px-3 py-3">
            <button
              type="button"
              data-testid="mobile-nav-logout"
              onClick={() => signOut({ callbackUrl: '/login?signed-out=1' })}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium tracking-tight text-zinc-700 transition-colors hover:bg-zinc-100/70 hover:text-zinc-900 cursor-pointer"
            >
              <LuLogOut aria-hidden className="h-5 w-5 text-rose-500" />
              <span>Cerrar sesión</span>
            </button>
          </footer>
        ) : null}
      </aside>
    </div>
  );
}

function NavRow({
  item,
  isActive,
  onSelect,
}: {
  item: MobileNavItem;
  isActive: (href: string) => boolean;
  /** Fires the moment a Link in this row is tapped — the drawer closes
   *  instantly so the user gets visual proof their tap landed, even
   *  before the next route's first paint. */
  onSelect: () => void;
}): React.ReactElement {
  const hasSub = (item.subItems?.length ?? 0) > 0;
  const active = isActive(item.href);
  const [expanded, setExpanded] = useState(active && hasSub);

  if (hasSub) {
    return (
      <li>
        <div
          className={`flex items-stretch rounded-2xl transition-colors ${
            active
              ? 'bg-sensu-50 text-sensu-700'
              : 'text-zinc-700 hover:bg-zinc-100/70 hover:text-zinc-900'
          }`}
        >
          <Link
            href={item.href}
            data-testid={`mobile-nav-${item.testId}`}
            aria-current={active ? 'page' : undefined}
            onClick={onSelect}
            className="flex flex-1 items-center gap-3 rounded-l-2xl px-3 py-2.5 text-sm font-medium tracking-tight"
          >
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
              {item.iconNode}
            </span>
            <span className="text-left">{item.label}</span>
          </Link>
          <button
            type="button"
            data-testid={`mobile-nav-${item.testId}-toggle`}
            aria-expanded={expanded}
            aria-controls={`mobile-nav-${item.testId}-subitems`}
            aria-label={expanded ? 'Cerrar secciones' : 'Abrir secciones'}
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex w-10 shrink-0 items-center justify-center rounded-r-2xl cursor-pointer"
          >
            <LuChevronDown
              aria-hidden
              className={`h-4 w-4 text-zinc-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
        {/* Animated collapse via the grid-rows trick: the wrapper
            transitions grid-template-rows between 0fr and 1fr, the
            inner div clips overflow. Browsers that support
            interpolation of grid-template-rows (modern Chromium,
            Firefox, Safari) animate the height smoothly.
            The testId lives on the WRAPPER so Playwright's
            `toBeVisible` reads the collapsed (0fr) bounding box
            correctly; `visibility: hidden` cascades to the children
            while collapsed so screen readers skip them too. */}
        <div
          id={`mobile-nav-${item.testId}-subitems`}
          data-testid={`mobile-nav-${item.testId}-subitems`}
          className={`grid transition-[grid-template-rows,visibility] duration-200 ease-out ${
            expanded
              ? 'grid-rows-[1fr] visible'
              : 'grid-rows-[0fr] invisible'
          }`}
          aria-hidden={!expanded}
        >
          <div className="overflow-hidden">
            <ul
              className="ml-7 mt-1 space-y-0.5 border-l border-zinc-200/80 pl-3"
            >
              <li>
                <Link
                  href={item.href}
                  data-testid={`mobile-nav-${item.testId}-overview`}
                  tabIndex={expanded ? 0 : -1}
                  onClick={onSelect}
                  className="block rounded-xl px-3 py-2 text-xs uppercase tracking-[0.14em] text-zinc-500 transition-colors hover:bg-zinc-100/70 hover:text-zinc-700"
                >
                  Ver todo
                </Link>
              </li>
              {item.subItems!.map((s) => (
                <li key={s.href}>
                  <Link
                    href={s.href}
                    data-testid={`mobile-nav-${s.testId}`}
                    tabIndex={expanded ? 0 : -1}
                    onClick={onSelect}
                    className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100/70 hover:text-zinc-900"
                  >
                    {s.iconNode ? (
                      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
                        {s.iconNode}
                      </span>
                    ) : null}
                    <span className="min-w-0 truncate">{s.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li>
      <Link
        href={item.href}
        data-testid={`mobile-nav-${item.testId}`}
        aria-current={active ? 'page' : undefined}
        onClick={onSelect}
        className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium tracking-tight transition-colors ${
          active
            ? 'bg-sensu-50 text-sensu-700'
            : 'text-zinc-700 hover:bg-zinc-100/70 hover:text-zinc-900'
        }`}
      >
        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
          {item.iconNode}
        </span>
        <span>{item.label}</span>
      </Link>
    </li>
  );
}
