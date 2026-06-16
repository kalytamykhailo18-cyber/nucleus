'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { LuChevronDown, LuChevronLeft, LuLogOut } from 'react-icons/lu';

/**
 * Single dropdown menu sitting on the right of the desktop header.
 * Replaces the inline tab row — clicking the trigger opens a smooth
 * panel listing every nav item vertically, with Cerrar sesión at the
 * bottom for authed users. Hidden on mobile (the left-side drawer
 * handles that surface).
 *
 * Items can carry `subItems`; when present, the row renders a chevron
 * affordance and tapping it expands a nested sub-list (e.g. /soporte
 * sections under the "Ayuda" row) using the same grid-rows + opacity
 * transition as the mobile drawer.
 *
 * Smooth open/close: the panel is always rendered. When closed it
 * fades, scales, and shifts upward into hidden state with
 * pointer-events disabled. Re-open reverses the transition. No abrupt
 * unmounts → no visible jank.
 */

export type HeaderMenuSubItem = {
  href: string;
  label: string;
  testId: string;
  iconNode?: React.ReactNode;
};

export type HeaderMenuItem = {
  href: string;
  label: string;
  testId: string;
  iconNode: React.ReactNode;
  /** Optional grouping: 'attention' → top, 'primary' → middle, 'admin' → bottom. */
  group?: 'attention' | 'primary' | 'admin';
  /** Optional nested list. When present, the row expands to reveal these. */
  subItems?: HeaderMenuSubItem[];
};

type Group = {
  key: 'attention' | 'primary' | 'admin';
  items: HeaderMenuItem[];
};

export function HeaderMenu({
  items,
  showLogout,
  triggerLabel = 'Menú',
  triggerContent,
}: {
  items: HeaderMenuItem[];
  showLogout: boolean;
  triggerLabel?: string;
  /** Optional rich trigger content (e.g. avatar + name). Falls back to a
   *  plain text label when not provided. */
  triggerContent?: React.ReactNode;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname() ?? '/';

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onClickOutside = (e: MouseEvent): void => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClickOutside);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const isActive = (href: string): boolean =>
    pathname === href || pathname.startsWith(`${href}/`);

  const groups: Group[] = [];
  for (const key of ['attention', 'primary', 'admin'] as const) {
    const groupItems = items.filter((i) => (i.group ?? 'primary') === key);
    if (groupItems.length > 0) groups.push({ key, items: groupItems });
  }

  return (
    <div ref={wrapperRef} className="relative hidden min-[960px]:block">
      <button
        type="button"
        data-testid="header-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex h-9 items-center gap-2 rounded-full px-2 text-sm font-medium tracking-tight transition-colors cursor-pointer ${
          open
            ? 'bg-zinc-100/70 text-zinc-900'
            : 'text-zinc-700 hover:bg-zinc-100/70 hover:text-zinc-900'
        }`}
      >
        {triggerContent ?? <span className="px-1">{triggerLabel}</span>}
        <LuChevronDown
          aria-hidden
          className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <div
        role="menu"
        data-testid="header-menu-panel"
        aria-hidden={!open}
        className={`absolute right-0 top-full z-40 origin-top-right pt-2 transition-all duration-200 ease-out ${
          open
            ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
            : 'opacity-0 -translate-y-1 scale-95 pointer-events-none'
        }`}
      >
        {/* The inner panel does NOT use overflow-hidden because the
            nested flyout for rows with sub-items renders as an
            absolute child and must extend past the panel's left
            edge. Hover backgrounds are inset with `mx-1 rounded-xl`
            on each list item to keep the rounded shape clean. */}
        <div className="w-64 rounded-2xl bg-white ring-1 ring-zinc-200 shadow-[0_2px_4px_rgba(15,23,42,0.06),0_24px_60px_rgba(15,23,42,0.18)]">
          {groups.map((g, gi) => (
            <ul
              key={g.key}
              data-testid={`header-menu-group-${g.key}`}
              className={
                gi === 0
                  ? 'py-1'
                  : 'border-t border-zinc-200/70 py-1'
              }
            >
              {g.items.map((item) => (
                <MenuRow
                  key={item.href}
                  item={item}
                  isActive={isActive}
                  onSelect={() => setOpen(false)}
                />
              ))}
            </ul>
          ))}
          {showLogout ? (
            <div className="border-t border-zinc-200/70 py-1">
              <button
                type="button"
                data-testid="header-menu-logout"
                onClick={() => signOut({ callbackUrl: '/login?signed-out=1' })}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium tracking-tight text-zinc-700 transition-colors hover:bg-zinc-100/70 hover:text-zinc-900 cursor-pointer"
              >
                <LuLogOut aria-hidden className="h-5 w-5 text-rose-500" />
                <span>Cerrar sesión</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MenuRow({
  item,
  isActive,
  onSelect,
}: {
  item: HeaderMenuItem;
  isActive: (href: string) => boolean;
  /** Fires the moment a Link inside this row is clicked — the parent uses
   *  it to close the dropdown instantly, before the route commits, so the
   *  user gets visual proof the click was registered. */
  onSelect: () => void;
}): React.ReactElement {
  const hasSub = (item.subItems?.length ?? 0) > 0;
  const active = isActive(item.href);
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Small grace period so a cursor crossing the parent → flyout gap
  // doesn't trigger an immediate close.
  const scheduleClose = (): void => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setFlyoutOpen(false), 120);
  };
  const cancelClose = (): void => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  if (hasSub) {
    return (
      <li
        className="relative"
        onMouseEnter={() => {
          cancelClose();
          setFlyoutOpen(true);
        }}
        onMouseLeave={scheduleClose}
      >
        <div
          className={`flex items-stretch transition-colors ${
            active || flyoutOpen
              ? 'bg-sensu-50 text-sensu-700'
              : 'text-zinc-700 hover:bg-zinc-100/70 hover:text-zinc-900'
          }`}
        >
          <Link
            href={item.href}
            data-testid={`header-menu-${item.testId}`}
            aria-current={active ? 'page' : undefined}
            onClick={onSelect}
            className="flex flex-1 items-center gap-3 px-4 py-2.5 text-sm font-medium tracking-tight"
          >
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
              {item.iconNode}
            </span>
            <span className="truncate text-left">{item.label}</span>
          </Link>
          <button
            type="button"
            data-testid={`header-menu-${item.testId}-toggle`}
            aria-haspopup="menu"
            aria-expanded={flyoutOpen}
            aria-label={flyoutOpen ? 'Cerrar secciones' : 'Abrir secciones'}
            onClick={() => setFlyoutOpen((v) => !v)}
            className="inline-flex w-9 shrink-0 items-center justify-center pr-3 cursor-pointer"
          >
            {/* Chevron points left toward the flyout's open direction
                (the submenu opens on the left of the parent panel). */}
            <LuChevronLeft
              aria-hidden
              className="h-3.5 w-3.5 text-zinc-400"
            />
          </button>
        </div>
        {/* Flyout positioned to the LEFT of the parent panel because
            the parent is right-anchored against the viewport edge.
            The panel sits flush against the parent — no gap means
            the cursor crosses directly from parent row to submenu
            without leaving the hover region. */}
        <div
          data-testid={`header-menu-${item.testId}-subitems`}
          aria-hidden={!flyoutOpen}
          className={`absolute right-full top-0 z-50 transition-all duration-200 ease-out ${
            flyoutOpen
              ? 'visible opacity-100 translate-x-0 pointer-events-auto'
              : 'invisible opacity-0 translate-x-1 pointer-events-none'
          }`}
        >
          <div className="w-64 overflow-hidden rounded-2xl bg-white ring-1 ring-zinc-200 shadow-[0_2px_4px_rgba(15,23,42,0.06),0_24px_60px_rgba(15,23,42,0.18)]">
            <Link
              href={item.href}
              data-testid={`header-menu-${item.testId}-overview`}
              tabIndex={flyoutOpen ? 0 : -1}
              onClick={onSelect}
              className="block border-b border-zinc-100 px-4 py-2.5 text-[11px] uppercase tracking-[0.14em] text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-700"
            >
              Ver todo
            </Link>
            <ul className="max-h-[60vh] overflow-y-auto py-1">
              {item.subItems!.map((s) => (
                <li key={s.href}>
                  <Link
                    href={s.href}
                    data-testid={`header-menu-${s.testId}`}
                    tabIndex={flyoutOpen ? 0 : -1}
                    onClick={onSelect}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 transition-colors hover:bg-sensu-50 hover:text-sensu-700"
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
        data-testid={`header-menu-${item.testId}`}
        aria-current={active ? 'page' : undefined}
        onClick={onSelect}
        className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium tracking-tight transition-colors ${
          active
            ? 'bg-sensu-50 text-sensu-700'
            : 'text-zinc-700 hover:bg-zinc-100/70 hover:text-zinc-900'
        }`}
      >
        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
          {item.iconNode}
        </span>
        <span className="min-w-0 truncate">{item.label}</span>
      </Link>
    </li>
  );
}
