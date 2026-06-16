'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LuPencil } from 'react-icons/lu';
import {
  CardEditModal,
  saveLandingFields,
  type CardEditField,
} from './card-edit-modal';

/**
 * Tiny pencil button that drops into a landing-page card and opens a
 * `CardEditModal` with the supplied fields (Ustym 2026-05-29 —
 * each card uses one modal, not one pencil per field).
 *
 * After a successful save the component fires `router.refresh()` so
 * the server re-fetches the LandingItem overrides and the card
 * re-renders with the new values. No section-specific state to wire.
 */
export function CardEditPencil({
  slugBase,
  modalTitle,
  fields,
  className,
}: {
  slugBase: string;
  modalTitle: string;
  fields: CardEditField[];
  /** Optional positioning override — defaults to top-right corner of the parent. */
  className?: string;
}): React.ReactElement {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        // Stop pointerdown bubbling so drag-tracking parents (e.g.
        // the testimonial carousel viewport) don't capture the
        // pointer and swallow the click before it reaches the button.
        onPointerDown={(e) => e.stopPropagation()}
        data-testid={`card-edit-pencil-${slugBase}`}
        title="Editar tarjeta"
        aria-label={`Editar ${slugBase}`}
        className={
          className ??
          // `z-10` keeps the pencil above sibling elements that have
          // `position: relative` without an explicit z-index (e.g. the
          // hero / product / coverage images on `/`). Without it,
          // siblings declared later in DOM order paint on top despite
          // no explicit z-index, hiding the pencil under the image.
          'absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-sensu-600 opacity-80 shadow-sm ring-1 ring-inset ring-sensu-200 transition-opacity hover:opacity-100 cursor-pointer'
        }
      >
        <LuPencil aria-hidden className="h-4 w-4" />
      </button>
      <CardEditModal
        open={open}
        slugBase={slugBase}
        title={modalTitle}
        fields={fields}
        onCancel={() => setOpen(false)}
        onSave={async (values) => {
          const result = await saveLandingFields(slugBase, values, fields);
          if (result.ok) router.refresh();
          return result;
        }}
      />
    </>
  );
}
