'use client';

import { useMemo, useState } from 'react';
import {
  LuBadgeCheck,
  LuBadgeMinus,
  LuCopy,
  LuLink,
  LuPencil,
  LuPlus,
} from 'react-icons/lu';
import { Modal } from '@/components/modal';

type Rep = {
  id: string;
  slug: string;
  name: string;
  email: string;
  phone: string | null;
  commissionBps: number;
  active: boolean;
  notes: string | null;
  createdAt: string | Date;
  _count: { subscriptions: number };
};

type FormState = {
  slug: string;
  name: string;
  email: string;
  phone: string;
  commissionPct: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  slug: '',
  name: '',
  email: '',
  phone: '',
  commissionPct: '20',
  notes: '',
};

function checkoutLink(slug: string): string {
  return `/checkout?plan=ANGELA_ESENCIAL&option=A&rep=${slug}`;
}

function absoluteCheckoutLink(slug: string): string {
  if (typeof window === 'undefined') return checkoutLink(slug);
  return `${window.location.origin}${checkoutLink(slug)}`;
}

export function AdminSalesRepsClient({
  initialReps,
}: {
  initialReps: Rep[];
}): React.ReactElement {
  const [reps, setReps] = useState<Rep[]>(initialReps);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<FormState>(EMPTY_FORM);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);
  const [editingRep, setEditingRep] = useState<Rep | null>(null);

  const active = useMemo(() => reps.filter((r) => r.active), [reps]);
  const inactive = useMemo(() => reps.filter((r) => !r.active), [reps]);

  async function submitCreate(): Promise<void> {
    setCreateBusy(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/admin/sales-reps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: createForm.slug.trim().toLowerCase(),
          name: createForm.name.trim(),
          email: createForm.email.trim().toLowerCase(),
          phone: createForm.phone.trim() || null,
          commissionBps: Math.round(
            (Number(createForm.commissionPct) || 0) * 100,
          ),
          notes: createForm.notes.trim() || null,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        id?: string;
        slug?: string;
      };
      if (!res.ok) {
        setCreateError(
          body.error === 'slug_or_email_exists'
            ? 'Ya existe un vendedor con ese enlace o correo.'
            : body.error === 'invalid'
              ? 'Revisa los campos, el enlace debe ser en minúsculas sin espacios.'
              : 'No se pudo crear el vendedor.',
        );
        return;
      }
      // Optimistic append then reload for accuracy.
      const listRes = await fetch('/api/admin/sales-reps');
      if (listRes.ok) {
        const data = (await listRes.json()) as { reps: Rep[] };
        setReps(data.reps);
      }
      setCreating(false);
      setCreateForm(EMPTY_FORM);
    } finally {
      setCreateBusy(false);
    }
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between">
        <p
          data-testid="admin-sales-reps-count"
          className="text-sm text-zinc-500"
        >
          <span className="font-medium text-zinc-700">{active.length}</span>{' '}
          activo{active.length === 1 ? '' : 's'}
          {inactive.length > 0 ? (
            <>
              {' · '}
              <span className="font-medium text-zinc-700">
                {inactive.length}
              </span>{' '}
              inactivo{inactive.length === 1 ? '' : 's'}
            </>
          ) : null}
        </p>
        <button
          type="button"
          data-testid="admin-sales-reps-new"
          onClick={() => {
            setCreateForm(EMPTY_FORM);
            setCreateError(null);
            setCreating(true);
          }}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-sensu-500 px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:scale-[0.98] cursor-pointer"
        >
          <LuPlus aria-hidden className="h-4 w-4" />
          Nuevo vendedor
        </button>
      </div>

      {reps.length === 0 ? (
        <div
          data-testid="admin-sales-reps-empty"
          className="mt-6 rounded-3xl bg-zinc-50 px-6 py-10 text-center text-sm text-zinc-500 ring-1 ring-zinc-100"
        >
          Aún no hay vendedores registrados. Crea el primero para
          empezar a rastrear ventas y comisiones.
        </div>
      ) : (
        <ul
          data-testid="admin-sales-reps-list"
          className="mt-5 space-y-3"
        >
          {[...active, ...inactive].map((rep) => (
            <RepRow key={rep.id} rep={rep} onEdit={() => setEditingRep(rep)} />
          ))}
        </ul>
      )}

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Nuevo vendedor"
        testId="admin-sales-reps-create-modal"
      >
        <RepForm
          form={createForm}
          setForm={setCreateForm}
          error={createError}
          busy={createBusy}
          onSubmit={submitCreate}
          onCancel={() => setCreating(false)}
          slugEditable
          submitLabel="Crear vendedor"
        />
      </Modal>

      {editingRep ? (
        <EditRepModal
          rep={editingRep}
          onClose={() => setEditingRep(null)}
          onSaved={(updated) => {
            setReps((prev) =>
              prev.map((r) =>
                r.id === updated.id ? { ...r, ...updated } : r,
              ),
            );
            setEditingRep(null);
          }}
        />
      ) : null}
    </div>
  );
}

function RepRow({
  rep,
  onEdit,
}: {
  rep: Rep;
  onEdit: () => void;
}): React.ReactElement {
  const [copied, setCopied] = useState(false);
  const commissionPct = (rep.commissionBps / 100).toFixed(1).replace(/\.0$/, '');

  async function copyLink(): Promise<void> {
    await navigator.clipboard.writeText(absoluteCheckoutLink(rep.slug));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <li
      data-testid={`admin-sales-rep-${rep.slug}`}
      className={`card-surface rounded-3xl px-5 py-4 ${
        rep.active ? '' : 'opacity-60'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-base font-semibold tracking-tight text-zinc-900">
            {rep.active ? (
              <LuBadgeCheck
                aria-hidden
                className="h-4 w-4 shrink-0 text-emerald-500"
              />
            ) : (
              <LuBadgeMinus
                aria-hidden
                className="h-4 w-4 shrink-0 text-zinc-400"
              />
            )}
            <span data-testid={`admin-sales-rep-${rep.slug}-name`}>
              {rep.name}
            </span>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
              {commissionPct}%
            </span>
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {rep.email}
            {rep.phone ? <> · {rep.phone}</> : null}
          </p>
          <p
            data-testid={`admin-sales-rep-${rep.slug}-sales`}
            className="mt-1 text-xs text-zinc-500"
          >
            {rep._count.subscriptions === 0
              ? 'Sin ventas todavía'
              : `${rep._count.subscriptions} venta${
                  rep._count.subscriptions === 1 ? '' : 's'
                } registrada${rep._count.subscriptions === 1 ? '' : 's'}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            data-testid={`admin-sales-rep-${rep.slug}-copy-link`}
            onClick={copyLink}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-3 text-xs font-medium text-zinc-700 ring-1 ring-inset ring-zinc-200 transition-transform hover:-translate-y-0.5 hover:bg-zinc-50 active:scale-[0.98] cursor-pointer"
          >
            {copied ? (
              <>
                <LuBadgeCheck aria-hidden className="h-3.5 w-3.5 text-emerald-500" />
                Copiado
              </>
            ) : (
              <>
                <LuCopy aria-hidden className="h-3.5 w-3.5" />
                Copiar enlace
              </>
            )}
          </button>
          <button
            type="button"
            data-testid={`admin-sales-rep-${rep.slug}-edit`}
            onClick={onEdit}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-zinc-600 ring-1 ring-inset ring-zinc-200 transition-transform hover:-translate-y-0.5 hover:bg-zinc-50 active:scale-[0.98] cursor-pointer"
            aria-label={`Editar ${rep.name}`}
          >
            <LuPencil aria-hidden className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-2xl bg-zinc-50 px-3 py-2 text-[11px] text-zinc-600 ring-1 ring-zinc-100">
        <LuLink aria-hidden className="h-3.5 w-3.5 shrink-0 text-sensu-500" />
        <code
          data-testid={`admin-sales-rep-${rep.slug}-link`}
          className="min-w-0 truncate font-mono"
        >
          {checkoutLink(rep.slug)}
        </code>
      </div>
    </li>
  );
}

function EditRepModal({
  rep,
  onClose,
  onSaved,
}: {
  rep: Rep;
  onClose: () => void;
  onSaved: (updated: Rep) => void;
}): React.ReactElement {
  const [form, setForm] = useState<FormState>({
    slug: rep.slug,
    name: rep.name,
    email: rep.email,
    phone: rep.phone ?? '',
    commissionPct: (rep.commissionBps / 100).toString(),
    notes: rep.notes ?? '',
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(rep.active);

  async function save(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/sales-reps/${rep.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim() || null,
          commissionBps: Math.round((Number(form.commissionPct) || 0) * 100),
          notes: form.notes.trim() || null,
          active,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        rep?: { id: string };
        error?: string;
      };
      if (!res.ok) {
        setError(
          body.error === 'email_exists'
            ? 'Otro vendedor ya usa ese correo.'
            : 'No se pudo guardar.',
        );
        return;
      }
      onSaved({
        ...rep,
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || null,
        commissionBps: Math.round((Number(form.commissionPct) || 0) * 100),
        notes: form.notes.trim() || null,
        active,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Editar · ${rep.name}`}
      testId="admin-sales-reps-edit-modal"
    >
      <RepForm
        form={form}
        setForm={setForm}
        error={error}
        busy={busy}
        onSubmit={save}
        onCancel={onClose}
        slugEditable={false}
        submitLabel="Guardar cambios"
        extra={
          <label
            data-testid="admin-sales-reps-edit-active"
            className="mt-3 flex cursor-pointer items-center gap-3 rounded-2xl bg-zinc-50 px-4 py-3 ring-1 ring-zinc-100"
          >
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm text-zinc-700">
              Vendedor activo. Si lo desactivas, su enlace deja de
              asignar nuevas ventas.
            </span>
          </label>
        }
      />
    </Modal>
  );
}

function RepForm({
  form,
  setForm,
  error,
  busy,
  onSubmit,
  onCancel,
  slugEditable,
  submitLabel,
  extra,
}: {
  form: FormState;
  setForm: (next: FormState) => void;
  error: string | null;
  busy: boolean;
  onSubmit: () => void | Promise<void>;
  onCancel: () => void;
  slugEditable: boolean;
  submitLabel: string;
  extra?: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
          Nombre
        </span>
        <input
          data-testid="admin-sales-reps-form-name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="h-10 rounded-2xl bg-white px-3 text-sm text-zinc-900 ring-1 ring-inset ring-zinc-200 focus:outline-none focus:ring-2 focus:ring-sensu-400"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
          Enlace del vendedor{' '}
          <span className="text-zinc-400 normal-case tracking-normal">
            (minúsculas, sin espacios)
          </span>
        </span>
        <input
          data-testid="admin-sales-reps-form-slug"
          value={form.slug}
          disabled={!slugEditable}
          onChange={(e) =>
            setForm({ ...form, slug: e.target.value.toLowerCase() })
          }
          className={`h-10 rounded-2xl px-3 text-sm ring-1 ring-inset ring-zinc-200 focus:outline-none focus:ring-2 focus:ring-sensu-400 ${
            slugEditable ? 'bg-white text-zinc-900' : 'bg-zinc-50 text-zinc-500 cursor-not-allowed'
          }`}
          placeholder="p. ej. guillermo"
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
            Correo
          </span>
          <input
            data-testid="admin-sales-reps-form-email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="h-10 rounded-2xl bg-white px-3 text-sm text-zinc-900 ring-1 ring-inset ring-zinc-200 focus:outline-none focus:ring-2 focus:ring-sensu-400"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
            Teléfono (opcional)
          </span>
          <input
            data-testid="admin-sales-reps-form-phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="h-10 rounded-2xl bg-white px-3 text-sm text-zinc-900 ring-1 ring-inset ring-zinc-200 focus:outline-none focus:ring-2 focus:ring-sensu-400"
          />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
          Comisión %
        </span>
        <input
          data-testid="admin-sales-reps-form-commission"
          type="number"
          min={0}
          max={100}
          step={0.5}
          value={form.commissionPct}
          onChange={(e) => setForm({ ...form, commissionPct: e.target.value })}
          className="h-10 w-32 rounded-2xl bg-white px-3 text-sm text-zinc-900 ring-1 ring-inset ring-zinc-200 focus:outline-none focus:ring-2 focus:ring-sensu-400"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
          Notas (opcional)
        </span>
        <textarea
          data-testid="admin-sales-reps-form-notes"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          rows={3}
          className="rounded-2xl bg-white px-3 py-2 text-sm text-zinc-900 ring-1 ring-inset ring-zinc-200 focus:outline-none focus:ring-2 focus:ring-sensu-400"
        />
      </label>
      {extra}
      {error ? (
        <p
          data-testid="admin-sales-reps-form-error"
          className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-inset ring-rose-200"
        >
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="inline-flex h-10 items-center rounded-full px-4 text-sm font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 cursor-pointer"
        >
          Cancelar
        </button>
        <button
          type="button"
          data-testid="admin-sales-reps-form-submit"
          onClick={onSubmit}
          disabled={busy || !form.name.trim() || !form.email.trim() || (slugEditable && !form.slug.trim())}
          className="inline-flex h-10 items-center rounded-full bg-sensu-500 px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50 disabled:hover:translate-y-0 cursor-pointer"
        >
          {busy ? 'Guardando…' : submitLabel}
        </button>
      </div>
    </div>
  );
}
