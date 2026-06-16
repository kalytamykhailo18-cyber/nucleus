'use client';

import { useEffect, useState } from 'react';
import {
  LuCopy,
  LuEye,
  LuLink,
  LuMail,
  LuRefreshCcw,
  LuShield,
  LuTrash2,
  LuUsers,
} from 'react-icons/lu';
import { ConfirmModal } from './confirm-modal';
import { SectionLabel } from './section-label';

interface MasterDevice {
  deviceId: string;
  label: string;
}

interface InviteSummary {
  code: string;
  email: string | null;
  expiresAt: string;
  consumedAt: string | null;
  consumedByEmail: string | null;
  deviceLabel: string;
  createdAt: string;
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', {
    timeZone: 'America/Mexico_City',
    day: '2-digit',
    month: 'short',
  });
}

/**
 * "Compartir con mi familia" card — surfaces on /profile only for
 * Master Users. Shows the 6-digit Client ID and the share password
 * the family hands out so a relative can claim a Watcher seat via
 * the IMEI + Client ID + share password signup path (or by
 * accepting an emailed invite).
 *
 * Lazy fetch: hits GET /api/profile/family-share which generates the
 * pair on first read. "Cambiar contraseña" POSTs to the same path to
 * rotate the password (Client ID stays stable).
 */
export function FamilyShareCard(): React.ReactElement {
  const [share, setShare] = useState<{ clientId: string; shareCode: string } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);
  const [copied, setCopied] = useState<'id' | 'code' | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/profile/family-share', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as { clientId: string; shareCode: string };
        if (!cancelled) setShare(body);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudo cargar');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async (
    value: string,
    which: 'id' | 'code',
  ): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
    } catch {
      // older browsers — silent fail, user can still select and copy
    }
  };

  const rotate = async (): Promise<void> => {
    setRotating(true);
    try {
      const res = await fetch('/api/profile/family-share', { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { clientId: string; shareCode: string };
      setShare(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al rotar');
    } finally {
      setRotating(false);
    }
  };

  return (
    <section
      data-testid="family-share-card"
      className="card-surface rounded-3xl p-6 animate-fade-up"
    >
      <SectionLabel icon={LuUsers} tone="sensu">
        Compartir con mi familia
      </SectionLabel>
      <p className="mt-3 text-sm text-zinc-600 leading-relaxed">
        Tus familiares se unen como observadores con este ID y contraseña.
        En el inicio, eligen "Soy familiar de un usuario Sensu" y los
        capturan junto con el IMEI del dispositivo.
      </p>

      {error ? (
        <p
          data-testid="family-share-error"
          className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200"
        >
          {error}
        </p>
      ) : null}

      {share ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <ShareField
            label="ID de Cliente"
            value={share.clientId}
            displayValue={`${share.clientId.slice(0, 3)} ${share.clientId.slice(3)}`}
            copied={copied === 'id'}
            testId="family-share-clientId"
            onCopy={() => void copy(share.clientId, 'id')}
            iconNode={<LuShield aria-hidden className="h-4 w-4 text-sensu-500" />}
          />
          <ShareField
            label="Contraseña para compartir"
            value={share.shareCode}
            displayValue={share.shareCode}
            copied={copied === 'code'}
            testId="family-share-shareCode"
            onCopy={() => void copy(share.shareCode, 'code')}
            iconNode={<LuShield aria-hidden className="h-4 w-4 text-violet-500" />}
          />
        </div>
      ) : !error ? (
        <div
          aria-hidden
          className="mt-5 grid gap-3 sm:grid-cols-2"
        >
          <div className="h-20 rounded-2xl bg-zinc-100/70 animate-fade-in" />
          <div className="h-20 rounded-2xl bg-zinc-100/70 animate-fade-in" />
        </div>
      ) : null}

      {share ? (
        <div className="mt-5 flex items-center justify-end">
          <button
            type="button"
            data-testid="family-share-rotate"
            onClick={() => void rotate()}
            disabled={rotating}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium tracking-tight text-zinc-600 transition-colors hover:bg-zinc-100/70 hover:text-zinc-900 disabled:opacity-50 cursor-pointer"
          >
            <LuRefreshCcw
              aria-hidden
              className={`h-3.5 w-3.5 ${rotating ? 'animate-spin' : ''}`}
            />
            {rotating ? 'Generando…' : 'Cambiar contraseña'}
          </button>
        </div>
      ) : null}

      <InviteFamilySection />
      <FamilyWatchersSection />
    </section>
  );
}

interface WatcherSummary {
  userDeviceId: string;
  userId: string;
  email: string;
  fullName: string | null;
  eviewDeviceId: string;
  deviceLabel: string;
  assignedAt: string;
}

function FamilyWatchersSection(): React.ReactElement | null {
  const [watchers, setWatchers] = useState<WatcherSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [pendingRevoke, setPendingRevoke] = useState<WatcherSummary | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async (): Promise<void> => {
    const res = await fetch('/api/profile/watchers', { cache: 'no-store' });
    if (!res.ok) {
      setLoaded(true);
      return;
    }
    const body = (await res.json()) as { watchers: WatcherSummary[] };
    setWatchers(body.watchers);
    setLoaded(true);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const revoke = async (): Promise<void> => {
    if (!pendingRevoke) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/profile/watchers/${encodeURIComponent(pendingRevoke.userDeviceId)}`,
        { method: 'DELETE' },
      );
      if (res.ok) {
        setPendingRevoke(null);
        await refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) return null;
  if (watchers.length === 0) return null;

  return (
    <div
      data-testid="family-watchers-section"
      className="mt-8 border-t border-zinc-200/70 pt-6"
    >
      <SectionLabel icon={LuEye} tone="sensu">
        Familiares con acceso
      </SectionLabel>
      <p className="mt-2 text-sm text-zinc-600 leading-relaxed">
        Los siguientes familiares observan los dispositivos que tú
        administras. Puedes quitarles el acceso en cualquier momento.
      </p>
      <ul className="mt-4 grid gap-2">
        {watchers.map((w) => (
          <li
            key={w.userDeviceId}
            data-testid={`family-watcher-${w.userDeviceId}`}
            className="flex min-w-0 items-center gap-3 rounded-xl bg-zinc-50/70 px-3 py-2 text-sm text-zinc-700 ring-1 ring-zinc-200/70"
          >
            <LuUsers aria-hidden className="h-4 w-4 shrink-0 text-sensu-500" />
            <span className="min-w-0 flex-1 truncate">
              <span className="font-medium text-zinc-900">
                {w.fullName?.trim() || w.email}
              </span>
              {w.fullName?.trim() ? (
                <span className="text-zinc-500"> · {w.email}</span>
              ) : null}
              <span className="text-zinc-500"> · {w.deviceLabel}</span>
            </span>
            <button
              type="button"
              data-testid={`family-watcher-${w.userDeviceId}-revoke`}
              onClick={() => setPendingRevoke(w)}
              aria-label="Quitar acceso"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-rose-600 transition-colors hover:bg-rose-50 cursor-pointer"
            >
              <LuTrash2 aria-hidden className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>

      <ConfirmModal
        open={pendingRevoke !== null}
        title={`Quitar acceso a ${pendingRevoke?.fullName?.trim() || pendingRevoke?.email || ''}`}
        body={`Dejará de ver ${pendingRevoke?.deviceLabel ?? 'el dispositivo'}. Puede volver a unirse con una nueva invitación o con tu ID de cliente.`}
        confirmLabel="Quitar acceso"
        busy={busy}
        onConfirm={() => void revoke()}
        onCancel={() => setPendingRevoke(null)}
        testId="family-watcher-revoke-confirm"
      />
    </div>
  );
}

function InviteFamilySection(): React.ReactElement {
  const [devices, setDevices] = useState<MasterDevice[]>([]);
  const [invites, setInvites] = useState<InviteSummary[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUrl, setLastUrl] = useState<string | null>(null);

  const refresh = async (): Promise<void> => {
    const [dev, inv] = await Promise.all([
      fetch('/api/profile/master-devices', { cache: 'no-store' }).then(
        (r) => r.json() as Promise<{ devices: MasterDevice[] }>,
      ),
      fetch('/api/family-invites', { cache: 'no-store' }).then(
        (r) => r.json() as Promise<{ invites: InviteSummary[] }>,
      ),
    ]);
    setDevices(dev.devices);
    setInvites(inv.invites);
    if (!selectedDevice && dev.devices.length > 0) {
      setSelectedDevice(dev.devices[0]!.deviceId);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!selectedDevice) return;
    setBusy(true);
    setError(null);
    setLastUrl(null);
    try {
      const res = await fetch('/api/family-invites', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          eviewDeviceId: selectedDevice,
          email: email.trim() || null,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        url?: string;
        message?: string;
      };
      if (!res.ok) {
        setError(body.message ?? 'No se pudo crear la invitación.');
        return;
      }
      setLastUrl(body.url ?? null);
      setEmail('');
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (code: string): Promise<void> => {
    const res = await fetch(`/api/family-invites/${encodeURIComponent(code)}`, {
      method: 'DELETE',
    });
    if (res.ok) await refresh();
  };

  if (devices.length === 0) return <></>;

  const pending = invites.filter((i) => !i.consumedAt);

  return (
    <div
      data-testid="family-invite-section"
      className="mt-8 border-t border-zinc-200/70 pt-6"
    >
      <SectionLabel icon={LuMail} tone="violet">
        Invitar por correo
      </SectionLabel>
      <p className="mt-2 text-sm text-zinc-600 leading-relaxed">
        Mandamos un enlace al correo de tu familiar. Acepta el enlace y
        queda agregado como observador en el dispositivo elegido.
      </p>
      <form
        data-testid="family-invite-form"
        onSubmit={(e) => void submit(e)}
        className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
      >
        <input
          type="email"
          required
          placeholder="correo@familia.com"
          data-testid="family-invite-email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-sensu-400 focus:ring-2 focus:ring-sensu-200"
        />
        <select
          data-testid="family-invite-device"
          value={selectedDevice}
          onChange={(e) => setSelectedDevice(e.target.value)}
          className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-sensu-400 focus:ring-2 focus:ring-sensu-200 cursor-pointer"
        >
          {devices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          data-testid="family-invite-submit"
          disabled={busy}
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-sensu-500 px-4 text-sm font-medium tracking-tight text-white transition-transform hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
        >
          {busy ? 'Enviando…' : 'Enviar invitación'}
        </button>
      </form>

      {error ? (
        <p
          data-testid="family-invite-error"
          className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200"
        >
          {error}
        </p>
      ) : null}

      {lastUrl ? (
        <p
          data-testid="family-invite-last-url"
          className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200"
        >
          <LuLink aria-hidden className="h-4 w-4 text-emerald-600" />
          Enlace listo. Si el correo no llega, comparte:&nbsp;
          <code className="break-all font-mono text-xs">{lastUrl}</code>
        </p>
      ) : null}

      {pending.length > 0 ? (
        <div className="mt-6">
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
            Invitaciones pendientes
          </p>
          <ul
            data-testid="family-invite-pending"
            className="mt-2 grid gap-2"
          >
            {pending.map((p) => (
              <li
                key={p.code}
                data-testid={`family-invite-pending-${p.code}`}
                className="flex min-w-0 items-center gap-3 rounded-xl bg-zinc-50/70 px-3 py-2 text-sm text-zinc-700 ring-1 ring-zinc-200/70"
              >
                <LuMail aria-hidden className="h-4 w-4 shrink-0 text-violet-500" />
                <span className="min-w-0 flex-1 truncate">
                  {p.email ?? 'Enlace sin correo'} ·{' '}
                  <span className="text-zinc-500">{p.deviceLabel}</span>
                </span>
                <span className="text-xs text-zinc-500">
                  Vence {formatDateShort(p.expiresAt)}
                </span>
                <button
                  type="button"
                  data-testid={`family-invite-pending-${p.code}-revoke`}
                  onClick={() => void revoke(p.code)}
                  aria-label="Revocar invitación"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-rose-600 transition-colors hover:bg-rose-50 cursor-pointer"
                >
                  <LuTrash2 aria-hidden className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function ShareField({
  label,
  value: _value,
  displayValue,
  copied,
  testId,
  onCopy,
  iconNode,
}: {
  label: string;
  value: string;
  displayValue: string;
  copied: boolean;
  testId: string;
  onCopy: () => void;
  iconNode: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-zinc-50/70 p-4 ring-1 ring-zinc-200/70">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-zinc-200">
        {iconNode}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">
          {label}
        </p>
        <p
          data-testid={testId}
          className="mt-1 font-mono text-lg tracking-wider text-zinc-900"
        >
          {displayValue}
        </p>
      </div>
      <button
        type="button"
        data-testid={`${testId}-copy`}
        onClick={onCopy}
        aria-label={`Copiar ${label}`}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sky-600 transition-colors hover:bg-sky-50 hover:text-sky-700 cursor-pointer"
      >
        {copied ? (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600">
            ✓
          </span>
        ) : (
          <LuCopy aria-hidden className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
