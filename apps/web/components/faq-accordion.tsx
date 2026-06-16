'use client';

import { useState } from 'react';
import { LuChevronDown } from 'react-icons/lu';
import { CardEditPencil } from './card-edit-pencil';

/**
 * FAQ accordion — one row open at a time, with a smooth height transition.
 *
 * `<details>` is kept as the wrapper (so existing tests can target `summary`)
 * but `open` is forced to `true`: that disables the UA's built-in display:none,
 * which is what kills CSS transitions on a vanilla disclosure. Visibility is
 * driven by a React state index and a `grid-template-rows: 0fr → 1fr` trick,
 * which is the cleanest way to animate from height 0 to height auto.
 *
 * Per Ustym 2026-05-29 — admins get ONE pencil per FAQ entry that opens
 * a `CardEditModal` with both the question and answer fields, not a
 * separate pencil per text.
 */
export type FaqItem = {
  slug: string;
  q: string;
  a: string;
};

export function FaqAccordion({
  items,
  isAdmin = false,
}: {
  items: FaqItem[];
  isAdmin?: boolean;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="card-surface mt-10 divide-y divide-zinc-100 rounded-3xl overflow-hidden">
      {items.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <details key={item.slug} open className="group relative">
            {isAdmin && (
              <CardEditPencil
                slugBase={item.slug}
                modalTitle="Editar pregunta"
                fields={[
                  { key: 'q', label: 'Pregunta', type: 'text', initial: item.q },
                  { key: 'a', label: 'Respuesta', type: 'multiline', initial: item.a },
                ]}
                className="absolute right-3 top-3 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-sensu-600 opacity-80 shadow-sm ring-1 ring-inset ring-sensu-200 transition-opacity hover:opacity-100 cursor-pointer"
              />
            )}
            <summary
              onClick={(e) => {
                e.preventDefault();
                setOpenIndex(isOpen ? null : i);
              }}
              className="flex cursor-pointer items-center justify-between gap-4 px-6 py-5 text-left list-none transition-colors hover:bg-zinc-50/60 sm:px-7 sm:py-6"
            >
              <span
                data-testid={`faq-${item.slug}-q`}
                className="text-sm sm:text-base font-medium tracking-tight text-zinc-900"
              >
                {item.q}
              </span>
              <LuChevronDown
                aria-hidden
                className={`h-4 w-4 shrink-0 text-sky-500 transition-transform duration-300 ${
                  isOpen ? 'rotate-180' : ''
                }`}
              />
            </summary>
            <div
              aria-hidden={!isOpen}
              className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
              }`}
            >
              <div className="overflow-hidden">
                <p
                  data-testid={`faq-${item.slug}-a`}
                  className="px-6 pb-6 text-sm leading-relaxed text-zinc-600 whitespace-pre-wrap sm:px-7 sm:pb-7"
                >
                  {item.a}
                </p>
              </div>
            </div>
          </details>
        );
      })}
    </div>
  );
}
