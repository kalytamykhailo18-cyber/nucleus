'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { LuChevronDown } from 'react-icons/lu';

interface SubItem {
  href: string;
  label: string;
  testId: string;
  iconNode: React.ReactNode;
}

interface MarketingNavTabProps {
  href: string;
  label: string;
  testId: string;
  icon: React.ReactNode;
  subItems?: SubItem[];
}

export function MarketingNavTab({
  href,
  label,
  testId,
  icon,
  subItems,
}: MarketingNavTabProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function cancelClose(): void {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }
  function scheduleClose(): void {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 220);
  }
  function openNow(): void {
    cancelClose();
    setOpen(true);
  }

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  return (
    <li
      className="relative"
      onMouseEnter={openNow}
      onMouseLeave={scheduleClose}
    >
      <Link
        href={href}
        data-testid={testId}
        onClick={() => setOpen(false)}
        onFocus={openNow}
        onBlur={scheduleClose}
        className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium tracking-tight text-zinc-700 transition-colors hover:bg-zinc-100/70 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sensu-500/40"
      >
        {icon}
        <span>{label}</span>
        {subItems ? (
          <LuChevronDown
            aria-hidden
            className={`h-3.5 w-3.5 text-zinc-400 transition-transform ${
              open ? 'rotate-180' : ''
            }`}
          />
        ) : null}
      </Link>
      {/* Dropdown wrapper carries a `pt-2` so the trigger area extends
          across the visual gap to the menu card. This prevents the menu
          from closing the instant the cursor leaves the tab — without
          this, the 8px space between tab and card breaks hover. */}
      {subItems && open ? (
        <div
          role="menu"
          className="absolute left-1/2 top-full z-40 w-64 -translate-x-1/2 pt-2"
        >
          <div className="rounded-2xl border border-zinc-200/70 bg-white p-2 shadow-[0_18px_40px_-20px_rgba(15,23,42,0.35)]">
            {subItems.map((sub) => (
              <Link
                key={sub.href}
                href={sub.href}
                data-testid={sub.testId}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
              >
                {sub.iconNode}
                <span className="truncate">{sub.label}</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </li>
  );
}
