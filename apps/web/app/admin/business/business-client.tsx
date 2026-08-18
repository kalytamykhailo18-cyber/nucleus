'use client';

import { LuDownload } from 'react-icons/lu';

/**
 * Business dashboard client shell — renders the 8-card grid. Individual
 * chart bodies are supplied by the server component; the shell adds a
 * CSV download link per card that hits /api/admin/business/export.csv.
 */

type Card = {
  slug: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  span: 'full' | 'half';
  body: React.ReactNode;
};

export function BusinessDashboardClient({
  cards,
}: {
  cards: readonly Card[];
}): React.ReactElement {
  return (
    <div
      data-testid="business-grid"
      className="grid min-w-0 gap-5 sm:grid-cols-2"
    >
      {cards.map((card) => (
        <article
          key={card.slug}
          data-testid={`business-card-${card.slug}`}
          className={`card-surface min-w-0 overflow-hidden rounded-3xl p-6 ${
            card.span === 'full' ? 'sm:col-span-2' : ''
          }`}
        >
          <header className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-zinc-50 ring-1 ring-inset ring-zinc-200">
                {card.icon}
              </span>
              <div>
                <h2 className="text-sm font-semibold text-zinc-900">
                  {card.title}
                </h2>
                <p className="text-xs text-zinc-500">{card.subtitle}</p>
              </div>
            </div>
            <a
              data-testid={`business-card-${card.slug}-csv`}
              href={`/api/admin/business/export.csv?chart=${card.slug}`}
              download
              aria-label={`Descargar ${card.title} en CSV`}
              title="Descargar CSV"
              className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white text-zinc-500 opacity-60 ring-1 ring-inset ring-zinc-200 transition-opacity hover:opacity-100"
            >
              <LuDownload aria-hidden className="h-3.5 w-3.5" />
            </a>
          </header>
          <div
            data-testid={`business-card-${card.slug}-body`}
            className="mt-6 min-h-[8rem]"
          >
            {card.body ?? (
              <div className="flex h-32 items-center justify-center text-xs text-zinc-400">
                Próximamente…
              </div>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
