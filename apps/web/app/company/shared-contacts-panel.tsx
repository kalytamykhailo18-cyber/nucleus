'use client';

import { useState } from 'react';
import {
  LuPhone,
  LuPlus,
  LuPencil,
  LuTrash2,
  LuShieldAlert,
} from 'react-icons/lu';
import { Modal } from '@/components/modal';
import { ConfirmModal } from '@/components/confirm-modal';

/**
 * Industrial-fleet shared emergency-contacts roster panel for the
 * HR / Safety lead (Phase C #1 reshape, Juan 2026-06-10).
 *
 * Renders the company-wide roster (priority asc), with a single
 * "Editar contactos compartidos" CTA that opens a modal containing
 * add / edit / delete actions. Each save fires against the customer-
 * side companion API at /api/company/contacts.
 *
 * Mounted only when Company.isManagedFleet is true — the per-worker
 * EmergencyContact flow on /profile remains the SaaS-rail default for
 * non-industrial companies.
 */

export interface SharedContactRow {
  id: string;
  fullName: string;
  phone: string;
  relationship: string | null;
  priority: number;
}

type DraftRow = {
  fullName: string;
  phone: string;
  relationship: string;
};

const EMPTY_DRAFT: DraftRow = { fullName: '', phone: '', relationship: '' };

function isValid(d: DraftRow): boolean {
  return d.fullName.trim().length > 0 && d.phone.trim().length >= 7;
}

export function SharedContactsPanel({
  workerCount,
  initial,
}: {
  workerCount: number;
  initial: SharedContactRow[];
}): React.ReactElement {
  const [rows, setRows] = useState<SharedContactRow[]>(initial);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<
    | { mode: 'create'; draft: DraftRow }
    | { mode: 'edit'; id: string; draft: DraftRow }
    | null
  >(null);
  const [deleting, setDeleting] = useState<SharedContactRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openCreate = (): void => {
    setError(null);
    setEditing({ mode: 'create', draft: { ...EMPTY_DRAFT } });
  };
  const openEdit = (c: SharedContactRow): void => {
    setError(null);
    setEditing({
      mode: 'edit',
      id: c.id,
      draft: {
        fullName: c.fullName,
        phone: c.phone,
        relationship: c.relationship ?? '',
      },
    });
  };
  const closeEditor = (): void => {
    if (busy) return;
    setEditing(null);
    setError(null);
  };

  const save = async (): Promise<void> => {
    if (!editing || !isValid(editing.draft)) return;
    setBusy(true);
    setError(null);
    const body = {
      fullName: editing.draft.fullName,
      phone: editing.draft.phone,
      relationship: editing.draft.relationship.trim() || null,
    };
    try {
      let res: Response;
      if (editing.mode === 'create') {
        res = await fetch('/api/company/contacts', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch(`/api/company/contacts/${editing.id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
      }
      if (!res.ok) {
        setError('No pudimos guardar el contacto. Revisa los campos.');
        return;
      }
      const { contact } = (await res.json()) as { contact: SharedContactRow };
      setRows((prev) => {
        const filtered = prev.filter((c) => c.id !== contact.id);
        const next = [...filtered, contact];
        next.sort((a, b) => a.priority - b.priority);
        return next;
      });
      setEditing(null);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (): Promise<void> => {
    if (!deleting) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/company/contacts/${deleting.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        setError('No pudimos eliminar el contacto.');
        return;
      }
      setRows((prev) => prev.filter((c) => c.id !== deleting.id));
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      data-testid="company-shared-contacts-panel"
      className="card-surface mt-8 rounded-3xl p-6"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
            <LuShieldAlert aria-hidden className="h-3.5 w-3.5 text-sensu-500" />
            Contactos de emergencia compartidos
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Estos contactos se llaman cuando cualquiera de las {workerCount}{' '}
            Angelas de la flota dispara una alerta.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          data-testid="company-shared-contacts-edit"
          className="inline-flex items-center gap-1.5 rounded-full bg-sensu-500 px-4 py-2 text-xs font-medium text-white transition-transform hover:-translate-y-0.5 active:scale-[0.98] cursor-pointer"
        >
          <LuPencil aria-hidden className="h-3.5 w-3.5" />
          Editar contactos compartidos
        </button>
      </header>

      {rows.length === 0 ? (
        <p
          data-testid="company-shared-contacts-empty"
          className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200"
        >
          No hay contactos configurados todavía. Agrega al menos uno para
          que el call-center sepa a quién llamar ante una alerta.
        </p>
      ) : (
        <ul
          data-testid="company-shared-contacts-list"
          className="mt-4 space-y-2"
        >
          {rows.map((c) => (
            <li
              key={c.id}
              data-testid={`company-shared-contacts-row-${c.id}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-zinc-50 px-4 py-2 ring-1 ring-zinc-200"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-900">
                  {c.fullName}
                  {c.relationship && (
                    <span className="ml-2 text-xs font-normal text-zinc-500">
                      · {c.relationship}
                    </span>
                  )}
                </p>
                <p className="text-xs text-zinc-500">
                  <LuPhone aria-hidden className="mr-1 inline h-3 w-3" />
                  {c.phone}
                </p>
              </div>
              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-zinc-600 ring-1 ring-zinc-200 tabular-nums">
                Prioridad {c.priority}
              </span>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={open}
        onClose={() => {
          if (!busy) {
            setOpen(false);
            setEditing(null);
          }
        }}
        title="Contactos de emergencia compartidos"
        testId="company-shared-contacts-modal"
      >
        <div className="mt-4 space-y-3">
          <ul className="space-y-2">
            {rows.map((c) => (
              <li
                key={c.id}
                data-testid={`company-shared-contacts-modal-row-${c.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-zinc-50 px-3 py-2 ring-1 ring-zinc-200"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-900">
                    {c.fullName}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {c.phone}
                    {c.relationship ? ` · ${c.relationship}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(c)}
                    data-testid={`company-shared-contacts-modal-edit-${c.id}`}
                    className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-100 cursor-pointer"
                  >
                    <LuPencil aria-hidden className="h-3 w-3" />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(c)}
                    data-testid={`company-shared-contacts-modal-delete-${c.id}`}
                    className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100 cursor-pointer"
                  >
                    <LuTrash2 aria-hidden className="h-3 w-3" />
                    Eliminar
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {!editing && (
            <button
              type="button"
              onClick={openCreate}
              data-testid="company-shared-contacts-modal-add"
              className="inline-flex items-center gap-1.5 rounded-full bg-sensu-50 px-3 py-1.5 text-xs font-medium text-sensu-700 ring-1 ring-sensu-200 hover:bg-sensu-100 cursor-pointer"
            >
              <LuPlus aria-hidden className="h-3.5 w-3.5" />
              Agregar contacto
            </button>
          )}

          {editing && (
            <form
              data-testid="company-shared-contacts-form"
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
              className="space-y-3 rounded-2xl bg-white p-3 ring-1 ring-zinc-200"
            >
              <Field label="Nombre">
                <input
                  type="text"
                  value={editing.draft.fullName}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      draft: { ...editing.draft, fullName: e.target.value },
                    })
                  }
                  data-testid="company-shared-contacts-input-name"
                  required
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-sensu-400 focus:ring-2 focus:ring-sensu-200"
                />
              </Field>
              <Field label="Teléfono">
                <input
                  type="tel"
                  value={editing.draft.phone}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      draft: { ...editing.draft, phone: e.target.value },
                    })
                  }
                  data-testid="company-shared-contacts-input-phone"
                  required
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-sensu-400 focus:ring-2 focus:ring-sensu-200"
                />
              </Field>
              <Field label="Relación (opcional)">
                <input
                  type="text"
                  value={editing.draft.relationship}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      draft: { ...editing.draft, relationship: e.target.value },
                    })
                  }
                  data-testid="company-shared-contacts-input-relationship"
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-sensu-400 focus:ring-2 focus:ring-sensu-200"
                />
              </Field>
              {error && (
                <p
                  data-testid="company-shared-contacts-form-error"
                  className="text-xs text-rose-600"
                >
                  {error}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeEditor}
                  disabled={busy}
                  className="inline-flex h-9 items-center rounded-full bg-white px-3 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50 cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={busy || !isValid(editing.draft)}
                  data-testid="company-shared-contacts-form-save"
                  className="inline-flex h-9 items-center rounded-full bg-sensu-500 px-3 text-xs font-medium text-white transition-transform hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-60 cursor-pointer"
                >
                  {busy ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </form>
          )}
        </div>
      </Modal>

      <ConfirmModal
        open={deleting !== null}
        onCancel={() => {
          if (!busy) setDeleting(null);
        }}
        onConfirm={() => void remove()}
        title="¿Eliminar contacto?"
        body={
          deleting
            ? `${deleting.fullName} dejará de ser llamado para alertas de los ${workerCount} dispositivos.`
            : ''
        }
        confirmLabel="Eliminar"
        testId="company-shared-contacts-delete-confirm"
        busy={busy}
      />
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <label className="block text-xs text-zinc-600">
      <span className="text-zinc-500">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
