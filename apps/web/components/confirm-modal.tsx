'use client';

import { LuTriangleAlert } from 'react-icons/lu';
import { Modal } from './modal';

/**
 * Confirmation modal — used for every destructive action in Nucleus.
 *
 * Title names the item ("Eliminar geocerca «Casa de la abuela»"), body
 * carries the consequence in one line, two buttons: cancel sky-styled,
 * confirm rose-styled and the default-focused element so a deliberate
 * Enter still confirms but a stray click on the backdrop cancels.
 */
export function ConfirmModal({
  open,
  title,
  body,
  confirmLabel = 'Eliminar',
  cancelLabel = 'Cancelar',
  busyLabel = 'Eliminando…',
  busy = false,
  onConfirm,
  onCancel,
  testId = 'confirm-modal',
  lockBodyScroll = true,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busyLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  testId?: string;
  lockBodyScroll?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      testId={testId}
      size="sm"
      lockBodyScroll={lockBodyScroll}
      cardClassName="ring-2 ring-rose-300"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-500"
        >
          <LuTriangleAlert className="h-4 w-4 text-rose-500" />
        </span>
        <p className="text-sm text-zinc-700 leading-relaxed">{body}</p>
      </div>
      <div className="mt-6 flex items-center justify-end gap-3">
        <button
          type="button"
          data-testid={`${testId}-cancel`}
          onClick={onCancel}
          disabled={busy}
          className="inline-flex items-center rounded-full bg-sky-50 px-4 py-2 text-sm font-medium tracking-tight text-sky-700 transition-colors hover:bg-sky-100 disabled:opacity-50"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          data-testid={`${testId}-confirm`}
          onClick={onConfirm}
          disabled={busy}
          className="inline-flex items-center rounded-full bg-rose-500 px-4 py-2 text-sm font-medium tracking-tight text-white transition-transform hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50 disabled:hover:translate-y-0"
        >
          {busy ? busyLabel : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
