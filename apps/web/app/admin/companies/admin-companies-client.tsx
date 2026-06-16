'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  LuArrowRight,
  LuCheck,
  LuFileText,
  LuPencil,
  LuPlus,
  LuTrash2,
  LuUpload,
  LuUsers,
} from 'react-icons/lu';
import { Modal } from '@/components/modal';
import { ConfirmModal } from '@/components/confirm-modal';
import type { CompanySummary } from '@/lib/companies';

type CompanyInvoice = {
  id: string;
  label: string;
  grossCentavos: number;
  status: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'VOID';
  dueAt: string | null;
  sentAt: string | null;
  paidAt: string | null;
  paymentReference: string | null;
  notes: string | null;
  createdAt: string;
};

type ImportRow = {
  email: string;
  fullName: string;
  phone?: string | null;
  employeeId?: string | null;
  jobTitle?: string | null;
};

type ImportOutcome = {
  email: string;
  status: 'created' | 'reused' | 'already_member' | 'error';
  message?: string;
};

type ImportResult = {
  summary: {
    total: number;
    created: number;
    reused: number;
    alreadyMember: number;
    error: number;
  };
  outcomes: ImportOutcome[];
};

type CompanyDraft = {
  name: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  notes: string;
  isActive: boolean;
  isManagedFleet: boolean;
};

const EMPTY_DRAFT: CompanyDraft = {
  name: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  notes: '',
  isActive: true,
  isManagedFleet: false,
};

function companyToDraft(c: CompanySummary): CompanyDraft {
  return {
    name: c.name,
    contactName: c.contactName ?? '',
    contactEmail: c.contactEmail ?? '',
    contactPhone: c.contactPhone ?? '',
    notes: c.notes ?? '',
    isActive: c.isActive,
    isManagedFleet: c.isManagedFleet ?? false,
  };
}

function isoToDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function AdminCompaniesClient({
  initialCompanies,
}: {
  initialCompanies: CompanySummary[];
}): React.ReactElement {
  const router = useRouter();
  const [editing, setEditing] = useState<
    | { mode: 'create'; draft: CompanyDraft }
    | { mode: 'edit'; id: string; draft: CompanyDraft }
    | null
  >(null);
  const [deleting, setDeleting] = useState<CompanySummary | null>(null);
  const [importing, setImporting] = useState<{
    company: CompanySummary;
    csv: string;
    parseError: string | null;
    result: ImportResult | null;
  } | null>(null);
  const [invoicing, setInvoicing] = useState<{
    company: CompanySummary;
    invoices: CompanyInvoice[] | null;
    creating: boolean;
    draft: {
      label: string;
      grossMxn: string;
      dueAt: string;
      paymentReference: string;
    };
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openCreate = (): void => {
    setError(null);
    setEditing({ mode: 'create', draft: { ...EMPTY_DRAFT } });
  };
  const openEdit = (c: CompanySummary): void => {
    setError(null);
    setEditing({ mode: 'edit', id: c.id, draft: companyToDraft(c) });
  };
  const close = (): void => {
    if (busy) return;
    setEditing(null);
    setDeleting(null);
    setImporting(null);
    setInvoicing(null);
    setError(null);
  };

  const openImport = (c: CompanySummary): void => {
    setError(null);
    setImporting({ company: c, csv: '', parseError: null, result: null });
  };

  const openInvoices = (c: CompanySummary): void => {
    setError(null);
    setInvoicing({
      company: c,
      invoices: null,
      creating: false,
      draft: { label: '', grossMxn: '', dueAt: '', paymentReference: '' },
    });
  };

  const refreshInvoices = async (companyId: string): Promise<CompanyInvoice[]> => {
    const res = await fetch(`/api/admin/companies/${companyId}/invoices`);
    if (!res.ok) return [];
    const data = (await res.json()) as { invoices: CompanyInvoice[] };
    return data.invoices;
  };

  const saveInvoice = async (): Promise<void> => {
    if (!invoicing) return;
    const grossPesos = Number(invoicing.draft.grossMxn);
    if (!Number.isFinite(grossPesos) || grossPesos < 0) {
      setError('Importe inválido (en pesos).');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/companies/${invoicing.company.id}/invoices`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            label: invoicing.draft.label,
            grossCentavos: Math.round(grossPesos * 100),
            dueAt: invoicing.draft.dueAt || null,
            paymentReference: invoicing.draft.paymentReference || null,
          }),
        },
      );
      if (!res.ok) {
        setError('No pudimos guardar la factura.');
        setBusy(false);
        return;
      }
      const invoices = await refreshInvoices(invoicing.company.id);
      setInvoicing({
        ...invoicing,
        invoices,
        creating: false,
        draft: { label: '', grossMxn: '', dueAt: '', paymentReference: '' },
      });
    } finally {
      setBusy(false);
    }
  };

  const markPaid = async (invoiceId: string): Promise<void> => {
    if (!invoicing) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/companies/${invoicing.company.id}/invoices/${invoiceId}`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            status: 'PAID',
            paidAt: new Date().toISOString(),
          }),
        },
      );
      if (!res.ok) {
        setError('No pudimos marcar la factura como pagada.');
      } else {
        const invoices = await refreshInvoices(invoicing.company.id);
        setInvoicing({ ...invoicing, invoices });
      }
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!invoicing || invoicing.invoices !== null) return;
    void refreshInvoices(invoicing.company.id).then((invoices) => {
      setInvoicing((cur) => (cur ? { ...cur, invoices } : cur));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoicing?.company.id]);

  const runImport = async (): Promise<void> => {
    if (!importing) return;
    setBusy(true);
    setError(null);
    const parsed = parseCsv(importing.csv);
    if (parsed.error) {
      setImporting({ ...importing, parseError: parsed.error });
      setBusy(false);
      return;
    }
    try {
      const res = await fetch(
        `/api/admin/companies/${importing.company.id}/import`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ rows: parsed.rows }),
        },
      );
      if (!res.ok) {
        setError('No pudimos importar los trabajadores. Revisa el archivo.');
        setBusy(false);
        return;
      }
      const data = (await res.json()) as { summary: ImportResult['summary']; outcomes: ImportOutcome[] };
      setImporting({
        ...importing,
        parseError: null,
        result: { summary: data.summary, outcomes: data.outcomes },
      });
      router.refresh();
    } catch {
      setError('Error de red. Inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  const save = async (): Promise<void> => {
    if (!editing) return;
    setBusy(true);
    setError(null);
    const payload = {
      name: editing.draft.name,
      contactName: editing.draft.contactName.trim() || null,
      contactEmail: editing.draft.contactEmail.trim() || null,
      contactPhone: editing.draft.contactPhone.trim() || null,
      notes: editing.draft.notes.trim() || null,
      isActive: editing.draft.isActive,
      isManagedFleet: editing.draft.isManagedFleet,
    };
    try {
      const url =
        editing.mode === 'create'
          ? '/api/admin/companies'
          : `/api/admin/companies/${editing.id}`;
      const method = editing.mode === 'create' ? 'POST' : 'PATCH';
      const res = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.error === 'name_exists') {
          setError('Ya existe una empresa con ese nombre.');
        } else {
          setError('No pudimos guardar la empresa. Revisa los campos.');
        }
        setBusy(false);
        return;
      }
      setEditing(null);
      router.refresh();
    } catch {
      setError('Error de red. Inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async (): Promise<void> => {
    if (!deleting) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/companies/${deleting.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        setError('No pudimos eliminar la empresa.');
        setBusy(false);
        return;
      }
      setDeleting(null);
      router.refresh();
    } catch {
      setError('Error de red. Inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-8 space-y-6">
      <header className="flex items-center justify-between">
        <p
          data-testid="admin-companies-count"
          className="text-sm text-zinc-500"
        >
          {initialCompanies.length === 1
            ? '1 empresa'
            : `${initialCompanies.length.toLocaleString('es-MX')} empresas`}
        </p>
        <button
          type="button"
          onClick={openCreate}
          data-testid="admin-companies-new"
          className="inline-flex h-10 items-center gap-2 rounded-full bg-sensu-500 px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:scale-[0.98] cursor-pointer"
        >
          <LuPlus aria-hidden className="h-4 w-4" />
          Nueva empresa
        </button>
      </header>

      {initialCompanies.length === 0 ? (
        <p
          data-testid="admin-companies-empty"
          className="card-surface rounded-3xl px-6 py-10 text-center text-sm text-zinc-500"
        >
          Aún no hay empresas registradas. Crea la primera para empezar.
        </p>
      ) : (
        <ul className="space-y-3" data-testid="admin-companies-list">
          {initialCompanies.map((c) => (
            <li
              key={c.id}
              data-testid={`admin-company-${c.id}`}
              className="card-surface flex flex-wrap items-start justify-between gap-4 rounded-2xl p-5"
            >
              <div className="min-w-0">
                <Link
                  href={`/admin/companies/${c.id}`}
                  data-testid={`admin-company-${c.id}-name`}
                  className="inline-flex items-center gap-1 text-base font-medium text-zinc-900 transition-colors hover:text-sensu-700"
                >
                  {c.name}
                </Link>
                {c.contactName && (
                  <p className="mt-0.5 text-xs text-zinc-500">
                    Contacto: {c.contactName}
                    {c.contactEmail ? ` · ${c.contactEmail}` : ''}
                    {c.contactPhone ? ` · ${c.contactPhone}` : ''}
                  </p>
                )}
                <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                  <span className="inline-flex items-center gap-1">
                    <LuUsers aria-hidden className="h-3 w-3" />
                    {c.adminCount} admin · {c.memberCount} miembros
                  </span>
                  {!c.isActive && (
                    <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-zinc-600 ring-1 ring-inset ring-zinc-200">
                      Inactiva
                    </span>
                  )}
                  <span className="text-zinc-400">
                    creada {isoToDate(c.createdAt)}
                  </span>
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Link
                  href={`/admin/companies/${c.id}`}
                  data-testid={`admin-company-${c.id}-open`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-3 text-sm font-medium text-sensu-700 ring-1 ring-inset ring-sensu-200 transition-colors hover:bg-sensu-50 cursor-pointer"
                >
                  <LuArrowRight aria-hidden className="h-4 w-4" />
                  Abrir
                </Link>
                <button
                  type="button"
                  onClick={() => openInvoices(c)}
                  data-testid={`admin-company-${c.id}-invoices`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-3 text-sm font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200 transition-colors hover:bg-indigo-50 cursor-pointer"
                >
                  <LuFileText aria-hidden className="h-4 w-4" />
                  Facturas
                </button>
                <button
                  type="button"
                  onClick={() => openImport(c)}
                  data-testid={`admin-company-${c.id}-import`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-3 text-sm font-medium text-sensu-700 ring-1 ring-inset ring-sensu-200 transition-colors hover:bg-sensu-50 cursor-pointer"
                >
                  <LuUpload aria-hidden className="h-4 w-4" />
                  Importar
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(c)}
                  data-testid={`admin-company-${c.id}-edit`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-3 text-sm font-medium text-zinc-700 ring-1 ring-inset ring-zinc-200 transition-colors hover:bg-zinc-50 cursor-pointer"
                >
                  <LuPencil aria-hidden className="h-4 w-4" />
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => setDeleting(c)}
                  data-testid={`admin-company-${c.id}-delete`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-3 text-sm font-medium text-rose-600 ring-1 ring-inset ring-rose-200 transition-colors hover:bg-rose-50 cursor-pointer"
                >
                  <LuTrash2 aria-hidden className="h-4 w-4" />
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={editing !== null}
        onClose={close}
        title={editing?.mode === 'edit' ? 'Editar empresa' : 'Nueva empresa'}
        testId="admin-companies-modal"
      >
        {editing && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
            className="space-y-4"
          >
            <Field label="Nombre">
              <input
                type="text"
                required
                value={editing.draft.name}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    draft: { ...editing.draft, name: e.target.value },
                  })
                }
                data-testid="admin-companies-input-name"
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-sensu-400 focus:ring-2 focus:ring-sensu-200"
              />
            </Field>
            <Field label="Contacto (nombre)">
              <input
                type="text"
                value={editing.draft.contactName}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    draft: { ...editing.draft, contactName: e.target.value },
                  })
                }
                data-testid="admin-companies-input-contact-name"
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-sensu-400 focus:ring-2 focus:ring-sensu-200"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Email de contacto">
                <input
                  type="email"
                  value={editing.draft.contactEmail}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      draft: { ...editing.draft, contactEmail: e.target.value },
                    })
                  }
                  data-testid="admin-companies-input-contact-email"
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-sensu-400 focus:ring-2 focus:ring-sensu-200"
                />
              </Field>
              <Field label="Teléfono de contacto">
                <input
                  type="tel"
                  value={editing.draft.contactPhone}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      draft: { ...editing.draft, contactPhone: e.target.value },
                    })
                  }
                  data-testid="admin-companies-input-contact-phone"
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-sensu-400 focus:ring-2 focus:ring-sensu-200"
                />
              </Field>
            </div>
            <Field label="Notas">
              <textarea
                rows={3}
                value={editing.draft.notes}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    draft: { ...editing.draft, notes: e.target.value },
                  })
                }
                data-testid="admin-companies-input-notes"
                className="w-full resize-y rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-sensu-400 focus:ring-2 focus:ring-sensu-200"
              />
            </Field>
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={editing.draft.isActive}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    draft: { ...editing.draft, isActive: e.target.checked },
                  })
                }
                data-testid="admin-companies-input-active"
              />
              <span>Empresa activa</span>
            </label>
            <label className="flex items-start gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={editing.draft.isManagedFleet}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    draft: { ...editing.draft, isManagedFleet: e.target.checked },
                  })
                }
                data-testid="admin-companies-input-managed-fleet"
              />
              <span>
                Flota administrada (industrial)
                <span className="block text-xs text-zinc-500">
                  Los dispositivos pertenecen a la empresa, no a cada
                  trabajador. La importación CSV solo pide nombres, no
                  emails, y los contactos de emergencia se comparten
                  para toda la flota.
                </span>
              </span>
            </label>
            {error && (
              <p
                data-testid="admin-companies-modal-error"
                className="text-sm text-rose-600"
              >
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={close}
                disabled={busy}
                className="inline-flex h-10 items-center rounded-full bg-white px-4 text-sm font-medium text-zinc-700 ring-1 ring-inset ring-zinc-200 transition-colors hover:bg-zinc-50 disabled:opacity-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={busy}
                data-testid="admin-companies-modal-save"
                className="inline-flex h-10 items-center rounded-full bg-sensu-500 px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-60 cursor-pointer"
              >
                {busy ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        open={invoicing !== null}
        onClose={close}
        title={
          invoicing ? `Facturas · ${invoicing.company.name}` : 'Facturas'
        }
        testId="admin-companies-invoices-modal"
        size="lg"
      >
        {invoicing && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-zinc-600">
                {invoicing.invoices === null
                  ? 'Cargando…'
                  : invoicing.invoices.length === 0
                    ? 'Sin facturas todavía.'
                    : `${invoicing.invoices.length} ${invoicing.invoices.length === 1 ? 'factura' : 'facturas'} registrada${invoicing.invoices.length === 1 ? '' : 's'}`}
              </p>
              {!invoicing.creating && (
                <button
                  type="button"
                  onClick={() =>
                    setInvoicing({ ...invoicing, creating: true })
                  }
                  data-testid="admin-companies-invoices-new"
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-sensu-500 px-3 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:scale-[0.98] cursor-pointer"
                >
                  <LuPlus aria-hidden className="h-4 w-4" />
                  Nueva factura
                </button>
              )}
            </div>

            {invoicing.creating && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void saveInvoice();
                }}
                className="space-y-3 rounded-2xl bg-zinc-50 p-4"
              >
                <Field label="Descripción / período">
                  <input
                    type="text"
                    required
                    value={invoicing.draft.label}
                    onChange={(e) =>
                      setInvoicing({
                        ...invoicing,
                        draft: { ...invoicing.draft, label: e.target.value },
                      })
                    }
                    placeholder="Mayo 2026 · 20 dispositivos"
                    data-testid="admin-companies-invoices-label"
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-sensu-400 focus:ring-2 focus:ring-sensu-200"
                  />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Importe (MXN, IVA incluido)">
                    <input
                      type="number"
                      required
                      step="0.01"
                      min="0"
                      value={invoicing.draft.grossMxn}
                      onChange={(e) =>
                        setInvoicing({
                          ...invoicing,
                          draft: { ...invoicing.draft, grossMxn: e.target.value },
                        })
                      }
                      data-testid="admin-companies-invoices-gross"
                      className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-sensu-400 focus:ring-2 focus:ring-sensu-200"
                    />
                  </Field>
                  <Field label="Vence el">
                    <input
                      type="date"
                      value={invoicing.draft.dueAt}
                      onChange={(e) =>
                        setInvoicing({
                          ...invoicing,
                          draft: { ...invoicing.draft, dueAt: e.target.value },
                        })
                      }
                      data-testid="admin-companies-invoices-due"
                      className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-sensu-400 focus:ring-2 focus:ring-sensu-200"
                    />
                  </Field>
                </div>
                {error && <p className="text-sm text-rose-600">{error}</p>}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setInvoicing({ ...invoicing, creating: false })
                    }
                    className="inline-flex h-9 items-center rounded-full bg-white px-3 text-sm font-medium text-zinc-700 ring-1 ring-inset ring-zinc-200 transition-colors hover:bg-zinc-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    data-testid="admin-companies-invoices-save"
                    className="inline-flex h-9 items-center rounded-full bg-sensu-500 px-3 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-60 cursor-pointer"
                  >
                    {busy ? 'Guardando…' : 'Guardar factura'}
                  </button>
                </div>
              </form>
            )}

            {invoicing.invoices && invoicing.invoices.length > 0 && (
              <ul
                data-testid="admin-companies-invoices-list"
                className="space-y-2"
              >
                {invoicing.invoices.map((inv) => (
                  <li
                    key={inv.id}
                    data-testid={`admin-companies-invoice-${inv.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-zinc-100"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-zinc-900">{inv.label}</p>
                      <p className="text-xs text-zinc-500">
                        <span className="tabular-nums">
                          ${(inv.grossCentavos / 100).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN
                        </span>
                        {inv.dueAt ? ` · vence ${new Date(inv.dueAt).toLocaleDateString('es-MX')}` : ''}
                      </p>
                    </div>
                    <span
                      data-testid={`admin-companies-invoice-${inv.id}-status`}
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${invoiceStatusTone(inv.status)}`}
                    >
                      {invoiceStatusLabel(inv.status)}
                    </span>
                    {inv.status !== 'PAID' && inv.status !== 'VOID' && (
                      <button
                        type="button"
                        onClick={() => void markPaid(inv.id)}
                        disabled={busy}
                        data-testid={`admin-companies-invoice-${inv.id}-mark-paid`}
                        className="inline-flex h-8 items-center gap-1 rounded-full bg-emerald-50 px-3 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200 transition-colors hover:bg-emerald-100 disabled:opacity-60 cursor-pointer"
                      >
                        <LuCheck aria-hidden className="h-3.5 w-3.5" />
                        Marcar pagada
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={importing !== null}
        onClose={close}
        title={
          importing
            ? `Importar trabajadores · ${importing.company.name}`
            : 'Importar trabajadores'
        }
        testId="admin-companies-import-modal"
        size="lg"
      >
        {importing && (
          <div className="space-y-4">
            <p className="text-sm text-zinc-600">
              Pega un CSV con encabezado{' '}
              <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">
                email,fullName,phone,employeeId,jobTitle
              </code>
              . Cada fila crea (o reutiliza) un usuario y le envía un
              correo de bienvenida con un enlace para fijar contraseña.
            </p>
            <textarea
              value={importing.csv}
              onChange={(e) =>
                setImporting({
                  ...importing,
                  csv: e.target.value,
                  parseError: null,
                })
              }
              rows={8}
              placeholder={
                'email,fullName,phone,employeeId,jobTitle\n' +
                'maria@example.com,Maria Lopez,+52 55 0000 0001,EMP-001,Soldadora\n' +
                'juan@example.com,Juan Perez,+52 55 0000 0002,EMP-002,Montacarguista'
              }
              data-testid="admin-companies-import-csv"
              className="w-full resize-y rounded-xl border border-zinc-200 bg-white px-3 py-2 font-mono text-xs text-zinc-900 outline-none focus:border-sensu-400 focus:ring-2 focus:ring-sensu-200"
            />
            {importing.parseError && (
              <p
                data-testid="admin-companies-import-parse-error"
                className="text-sm text-rose-600"
              >
                {importing.parseError}
              </p>
            )}
            {importing.result && (
              <div
                data-testid="admin-companies-import-result"
                className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-700"
              >
                <p>
                  <strong>{importing.result.summary.created}</strong> creados,{' '}
                  <strong>{importing.result.summary.reused}</strong> reutilizados,{' '}
                  <strong>{importing.result.summary.alreadyMember}</strong>{' '}
                  ya miembros,{' '}
                  <strong>{importing.result.summary.error}</strong> con error.
                </p>
                {importing.result.outcomes.some((o) => o.status === 'error') && (
                  <ul className="mt-2 list-disc pl-5 text-xs text-rose-700">
                    {importing.result.outcomes
                      .filter((o) => o.status === 'error')
                      .map((o, i) => (
                        <li key={i}>
                          {o.email}: {o.message ?? 'error'}
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            )}
            {error && (
              <p className="text-sm text-rose-600">{error}</p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={close}
                disabled={busy}
                className="inline-flex h-10 items-center rounded-full bg-white px-4 text-sm font-medium text-zinc-700 ring-1 ring-inset ring-zinc-200 transition-colors hover:bg-zinc-50 disabled:opacity-50 cursor-pointer"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => void runImport()}
                disabled={busy || importing.csv.trim().length === 0}
                data-testid="admin-companies-import-run"
                className="inline-flex h-10 items-center rounded-full bg-sensu-500 px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-60 cursor-pointer"
              >
                {busy ? 'Importando…' : 'Importar'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={deleting !== null}
        onCancel={close}
        onConfirm={confirmDelete}
        title={deleting ? `Eliminar "${deleting.name}"` : 'Eliminar empresa'}
        body={
          deleting
            ? `Esta acción también desvincula a sus ${deleting.adminCount + deleting.memberCount} miembros.`
            : ''
        }
        busy={busy}
        testId="admin-companies-delete-modal"
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
    <label className="block text-sm">
      <span className="block text-xs uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function invoiceStatusTone(s: CompanyInvoice['status']): string {
  switch (s) {
    case 'PAID':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    case 'SENT':
      return 'bg-sky-50 text-sky-700 ring-sky-200';
    case 'OVERDUE':
      return 'bg-rose-50 text-rose-700 ring-rose-200';
    case 'VOID':
      return 'bg-zinc-100 text-zinc-600 ring-zinc-200';
    default:
      return 'bg-amber-50 text-amber-700 ring-amber-200';
  }
}

function invoiceStatusLabel(s: CompanyInvoice['status']): string {
  switch (s) {
    case 'PAID':
      return 'Pagada';
    case 'SENT':
      return 'Enviada';
    case 'OVERDUE':
      return 'Vencida';
    case 'VOID':
      return 'Anulada';
    default:
      return 'Borrador';
  }
}

const REQUIRED_HEADERS = ['email', 'fullName'] as const;
const OPTIONAL_HEADERS = ['phone', 'employeeId', 'jobTitle'] as const;

function parseCsv(raw: string): { rows: ImportRow[]; error: string | null } {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) {
    return { rows: [], error: 'El CSV está vacío.' };
  }
  const header = lines[0]!.split(',').map((h) => h.trim());
  for (const req of REQUIRED_HEADERS) {
    if (!header.includes(req)) {
      return { rows: [], error: `Falta la columna obligatoria "${req}".` };
    }
  }
  const known = new Set<string>([...REQUIRED_HEADERS, ...OPTIONAL_HEADERS]);
  for (const h of header) {
    if (!known.has(h)) {
      return { rows: [], error: `Columna desconocida "${h}".` };
    }
  }
  const rows: ImportRow[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cells = lines[i]!.split(',').map((c) => c.trim());
    const record: Record<string, string> = {};
    header.forEach((h, j) => {
      record[h] = cells[j] ?? '';
    });
    if (!record.email || !record.fullName) {
      return { rows: [], error: `Fila ${i + 1}: email y fullName son obligatorios.` };
    }
    rows.push({
      email: record.email,
      fullName: record.fullName,
      phone: record.phone || null,
      employeeId: record.employeeId || null,
      jobTitle: record.jobTitle || null,
    });
  }
  if (rows.length === 0) {
    return { rows: [], error: 'No se encontraron filas con datos.' };
  }
  return { rows, error: null };
}
