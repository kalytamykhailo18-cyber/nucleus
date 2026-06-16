import Link from 'next/link';
import { LuChevronLeft, LuChevronRight } from 'react-icons/lu';

/**
 * Server-side pagination nav.
 *
 * Render once at the top and once at the bottom of every long admin list.
 * The component is rendered from a server component (no client JS) — page
 * transitions are plain `<Link>` navigations, so back/forward, deep-link,
 * and reload all work with no extra wiring on the consumer's side.
 *
 * The consumer is responsible for:
 *   - decoding the current page from its own `searchParams` (defaulting to 1),
 *   - applying `take`/`skip` against Prisma using `pageSize`,
 *   - passing the merged URL (other filters preserved) as `baseHref`, and
 *   - passing the active page-param name as `pageParam` (defaults to "page";
 *     pages with multiple lists use distinct params like `envio_page` /
 *     `act_page` so each list paginates independently).
 *
 * Behaviour:
 *   - "Mostrando X-Y de N" copy on the left.
 *   - Previous and Next buttons; disabled at the extremes.
 *   - Numbered pages with ellipsis around the active page (1 … 4 5 6 … 99).
 *   - Renders even when totalPages === 1 so the contract is consistent and
 *     E2E specs can assert the nav exists regardless of fixture size.
 */
export interface PaginationNavProps {
  currentPage: number;
  totalPages: number;
  totalRows: number;
  pageSize: number;
  baseHref: string;
  pageParam?: string;
  testIdPrefix: string;
  position: 'top' | 'bottom';
}

export function PaginationNav({
  currentPage,
  totalPages,
  totalRows,
  pageSize,
  baseHref,
  pageParam = 'page',
  testIdPrefix,
  position,
}: PaginationNavProps): React.ReactElement {
  const safeTotal = Math.max(1, totalPages);
  const safeCurrent = Math.min(Math.max(1, currentPage), safeTotal);
  const firstRow = totalRows === 0 ? 0 : (safeCurrent - 1) * pageSize + 1;
  const lastRow = Math.min(safeCurrent * pageSize, totalRows);

  function hrefFor(page: number): string {
    const url = new URL(baseHref, 'https://app.sensu.com.mx');
    url.searchParams.set(pageParam, String(page));
    return `${url.pathname}${url.search}`;
  }

  const numbered = pageNumbersWithEllipsis(safeCurrent, safeTotal);

  return (
    <nav
      data-testid={`${testIdPrefix}-${position}`}
      aria-label="Paginación"
      className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm text-zinc-600"
    >
      <p
        data-testid={`${testIdPrefix}-summary`}
        className="text-xs text-zinc-500"
      >
        {totalRows === 0
          ? 'Sin registros'
          : `Mostrando ${firstRow.toLocaleString('es-MX')}–${lastRow.toLocaleString('es-MX')} de ${totalRows.toLocaleString('es-MX')}`}
      </p>
      <div className="flex items-center gap-1">
        <PageLink
          href={hrefFor(Math.max(1, safeCurrent - 1))}
          disabled={safeCurrent <= 1}
          testId={`${testIdPrefix}-prev`}
          aria-label="Página anterior"
        >
          <LuChevronLeft className="h-4 w-4" />
        </PageLink>

        {/* Mobile: a single "current / total" indicator. Keeps the row
            on one line regardless of page count (long lists with 3-digit
            page numbers would otherwise overflow 320px viewports). */}
        <span
          data-testid={`${testIdPrefix}-page-indicator-mobile`}
          className="sm:hidden inline-flex h-8 min-w-12 items-center justify-center rounded-full bg-zinc-900 px-3 text-xs font-medium tabular-nums text-white"
        >
          {safeCurrent} / {safeTotal}
        </span>

        {/* sm+ : full numbered nav with ellipsis-around-current. */}
        <span className="hidden sm:inline-flex items-center gap-1">
          {numbered.map((entry, i) =>
            entry === 'ellipsis' ? (
              <span
                key={`gap-${i}`}
                aria-hidden
                className="px-2 text-zinc-400"
              >
                …
              </span>
            ) : (
              <PageLink
                key={entry}
                href={hrefFor(entry)}
                testId={`${testIdPrefix}-page-${entry}`}
                active={entry === safeCurrent}
              >
                {entry}
              </PageLink>
            ),
          )}
        </span>

        <PageLink
          href={hrefFor(Math.min(safeTotal, safeCurrent + 1))}
          disabled={safeCurrent >= safeTotal}
          testId={`${testIdPrefix}-next`}
          aria-label="Página siguiente"
        >
          <LuChevronRight className="h-4 w-4" />
        </PageLink>
      </div>
    </nav>
  );
}

function PageLink({
  href,
  disabled = false,
  active = false,
  testId,
  children,
  ...rest
}: {
  href: string;
  disabled?: boolean;
  active?: boolean;
  testId: string;
  children: React.ReactNode;
} & React.AriaAttributes): React.ReactElement {
  const base =
    'inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-xs font-medium tracking-tight transition-colors';
  if (disabled) {
    return (
      <span
        aria-disabled
        data-testid={testId}
        className={`${base} cursor-not-allowed bg-white text-zinc-300 ring-1 ring-zinc-200`}
        {...rest}
      >
        {children}
      </span>
    );
  }
  const skin = active
    ? 'bg-zinc-900 text-white ring-1 ring-zinc-900'
    : 'bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50';
  return (
    <Link
      href={href}
      data-testid={testId}
      aria-current={active ? 'page' : undefined}
      className={`${base} ${skin} cursor-pointer`}
      {...rest}
    >
      {children}
    </Link>
  );
}

type PageEntry = number | 'ellipsis';

/**
 * 1 … 4 5 6 … 99 — keep the first, last, and a window around the current.
 */
function pageNumbersWithEllipsis(
  current: number,
  total: number,
): PageEntry[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const out: PageEntry[] = [1];
  const from = Math.max(2, current - 1);
  const to = Math.min(total - 1, current + 1);
  if (from > 2) out.push('ellipsis');
  for (let i = from; i <= to; i += 1) out.push(i);
  if (to < total - 1) out.push('ellipsis');
  out.push(total);
  return out;
}
