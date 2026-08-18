'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  LuPhone,
  LuMail,
  LuMapPin,
  LuShield,
  LuBattery,
  LuTriangleAlert,
  LuUsers,
  LuSiren,
  LuListChecks,
  LuCheck,
  LuPencil,
  LuCircleDot,
  LuVolume2,
  LuVolumeOff,
} from 'react-icons/lu';
import { Modal } from '@/components/modal';
import { PaginationNav } from '@/components/pagination-nav';
import { BulkResolveButton } from './bulk-resolve-button';
import type { OperatorBoardAlert } from '@/lib/operator-board';
import type { OperatorPresence } from '@/lib/operator-presence';
import type { OperatorMapAlert } from '@/lib/operator-map';

// Leaflet touches `window` at module-load time, so the operator map
// has to skip SSR. next/dynamic with ssr:false defers the import
// until after hydration in the browser.
const OperatorMapClient = dynamic(
  () => import('./operator-map-client').then((m) => m.OperatorMapClient),
  { ssr: false },
);

interface OperatorPagination {
  currentPage: number;
  totalPages: number;
  totalRows: number;
  pageSize: number;
  baseHref: string;
}

type ActionKind =
  | 'CALLED_SENIOR'
  | 'CALLED_EMERGENCY_CONTACT'
  | 'CALLED_FAMILY'
  | 'PHONED_AURA'
  | 'CALLED_911'
  | 'DISPATCHED_AMBULANCE'
  | 'FALSE_ALARM'
  | 'NOTED'
  | 'RESOLVED';

interface OperatorActionRow {
  id: string;
  kind: ActionKind;
  note: string | null;
  createdAt: string;
  operator: { fullName: string | null; email: string };
}

const ACTION_LABEL: Record<ActionKind, string> = {
  CALLED_SENIOR: 'Llamé al adulto mayor',
  CALLED_EMERGENCY_CONTACT: 'Llamé al contacto de emergencia',
  CALLED_FAMILY: 'Llamé a la familia',
  PHONED_AURA: 'Llamé a Aura',
  CALLED_911: 'Llamé al 911',
  DISPATCHED_AMBULANCE: 'Despaché ambulancia',
  FALSE_ALARM: 'Falsa alarma',
  NOTED: 'Nota',
  RESOLVED: 'Marqué resuelto',
};

// Two-row grouping (Juan 2026-06-26): contact attempts on top, then
// the high-stakes closers on a separate row so a misclick on
// "RESOLVED" or "FALSA ALARMA" can't sneak in next to a regular
// callback button.
const CALL_ACTIONS: ActionKind[] = [
  'CALLED_SENIOR',
  'CALLED_EMERGENCY_CONTACT',
  'CALLED_FAMILY',
  'PHONED_AURA',
  'CALLED_911',
  'DISPATCHED_AMBULANCE',
];
const CLOSE_ACTIONS: ActionKind[] = ['RESOLVED', 'FALSE_ALARM'];
// Kinds that prompt a "Are you sure?" before firing — these
// effectively close the alert so the dispatcher should not be able to
// land them with a single accidental tap.
const CONFIRM_REQUIRED: Set<ActionKind> = new Set(['RESOLVED', 'FALSE_ALARM']);

interface RosterEnrichment {
  matchedBy: string;
  devices: Array<{
    deviceId: string;
    deviceName: string | null;
    phoneNumber: string | null;
  }>;
  accountOwner: { email: string; clientId: string | null; phone: string | null } | null;
  careRecipient: {
    fullName: string | null;
    phone: string | null;
    age: number | null;
    address: string | null;
    medicalConditions: string | null;
    insuranceInfo: string | null;
    livesAlone: boolean | null;
    auraIdentifier: string | null;
  } | null;
  watchers: Array<{ fullName: string | null; phone: string | null; email: string | null }>;
  emergencyContacts: Array<{ fullName: string | null; phone: string | null; relationship?: string | null }>;
  // Industrial-fleet rail (Phase C #1). Non-null only when the matched
  // device's MASTER is a MANAGED_WORKER on a Company with
  // isManagedFleet=true. The operator UI uses this to swap "Adulto
  // mayor" labels for "Trabajador", show the company name as a badge,
  // and re-title the emergency-contacts section so the dispatcher
  // knows they're phoning the shared company roster, not the worker's
  // personal family.
  managedFleet: {
    companyName: string;
    workerFullName: string | null;
    employeeId: string | null;
    jobTitle: string | null;
  } | null;
}

const EVENT_TONE: Record<string, { dot: string; chip: string; label: string }> = {
  sos: { dot: 'bg-rose-500', chip: 'bg-rose-50 text-rose-700 ring-rose-200', label: 'SOS' },
  fall_detection: { dot: 'bg-amber-500', chip: 'bg-amber-50 text-amber-700 ring-amber-200', label: 'Caída' },
  geofence_exit: { dot: 'bg-sky-500', chip: 'bg-sky-50 text-sky-700 ring-sky-200', label: 'Salida geocerca' },
  geofence_enter: { dot: 'bg-sky-400', chip: 'bg-sky-50 text-sky-700 ring-sky-200', label: 'Entrada geocerca' },
  battery_low: { dot: 'bg-yellow-500', chip: 'bg-yellow-50 text-yellow-700 ring-yellow-200', label: 'Batería baja' },
  button_press: { dot: 'bg-violet-500', chip: 'bg-violet-50 text-violet-700 ring-violet-200', label: 'Botón lateral' },
};

type FamilyFilter = 'all' | 'sos' | 'fall' | 'geofence' | 'battery' | 'button';

const FAMILY_CHIPS: ReadonlyArray<{ key: FamilyFilter; label: string }> = [
  { key: 'all', label: 'Todos' },
  { key: 'sos', label: 'SOS' },
  { key: 'fall', label: 'Caída' },
  { key: 'geofence', label: 'Geocerca' },
  { key: 'battery', label: 'Batería' },
  { key: 'button', label: 'Botón' },
];

function matchesFamily(eventType: string, filter: FamilyFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'sos':
      return eventType === 'sos';
    case 'fall':
      return eventType === 'fall_detection';
    case 'geofence':
      return eventType === 'geofence_enter' || eventType === 'geofence_exit';
    case 'battery':
      return eventType === 'battery_low';
    case 'button':
      return eventType === 'button_press';
  }
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  // Lock to America/Mexico_City so SSR (UTC container) and the
  // browser (Mexico-time visitor) render the same string — otherwise
  // React hydration error #418 fires on every page that lists alerts.
  return d.toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function OperatorBoardClient({
  initialAlerts,
  initialPresence,
  initialMapAlerts,
  auraCallNumber,
  pagination,
}: {
  initialAlerts: OperatorBoardAlert[];
  initialPresence: OperatorPresence[];
  initialMapAlerts: OperatorMapAlert[];
  auraCallNumber: string;
  pagination: OperatorPagination;
}): React.ReactElement {
  const [openAlert, setOpenAlert] = useState<OperatorBoardAlert | null>(null);
  const [roster, setRoster] = useState<RosterEnrichment | null>(null);
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneDraft, setPhoneDraft] = useState('');
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Two-step confirm for the closer actions (RESOLVED, FALSE_ALARM)
  // so a misclick on the dispatcher screen can't close a live
  // emergency. First click stages the kind; second click within
  // 6 seconds fires it. Resets to null on modal close or stale.
  const [pendingClose, setPendingClose] = useState<ActionKind | null>(null);
  const [actions, setActions] = useState<OperatorActionRow[]>([]);
  const [actionBusy, setActionBusy] = useState<ActionKind | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [family, setFamily] = useState<FamilyFilter>('all');
  const [unresolvedOnly, setUnresolvedOnly] = useState(false);
  // IDs the operator marked RESOLVED in this session — overlaid on the
  // server's `isResolved` so the badge shows immediately, no refresh
  // needed. The list itself is read straight from `initialAlerts` so a
  // `?page=N` navigation always swaps the rows (a prior implementation
  // copied `initialAlerts` into `useState`, which captured only the
  // first-mount value and silently broke pagination).
  const [sessionResolved, setSessionResolved] = useState<Set<string>>(
    () => new Set(),
  );

  // Heartbeat the session admin every 30 s so the presence panel knows
  // this tab is on shift. The first call fires immediately on mount so
  // the panel updates on the next page render without a 30 s lag.
  useEffect(() => {
    const ping = (): Promise<unknown> =>
      fetch('/api/admin/operator/heartbeat', { method: 'POST' }).catch(
        () => undefined,
      );
    void ping();
    const id = window.setInterval(ping, 30_000);
    return () => window.clearInterval(id);
  }, []);

  // Audible cue on new SOS / fall arrivals (Juan 2026-06-25, Phase B
  // polish). Operator board now polls /api/admin/operator/alerts every
  // 15 s; the first new emergency-class alert ID we see between polls
  // beeps a short Web Audio tone so the dispatcher cannot miss a
  // fresh page-1 arrival even when looking at another tab.
  //
  // First-load IDs seed the seen-set WITHOUT beeping (otherwise every
  // existing alert would scream the moment the page opens). Audio is
  // gated behind a Mute toggle the operator can flip — defaults to
  // ON because the whole point is the dispatcher hears it.
  const [muted, setMuted] = useState<boolean>(false);
  const seenAlertIdsRef = useRef<Set<string>>(
    new Set(initialAlerts.map((a) => a.id)),
  );
  const mutedRef = useRef(muted);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    const EMERGENCY_TYPES = new Set(['sos', 'fall_detection']);

    function playBeep(): void {
      if (typeof window === 'undefined') return;
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        // 880 Hz square-ish tone, 250 ms, soft fade-in/out — sharp
        // enough to grab attention, short enough not to annoy when
        // multiple alerts land in quick succession.
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.02);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.25);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
        osc.onended = (): void => {
          ctx.close().catch(() => undefined);
        };
      } catch {
        // Browser blocked autoplay (no user gesture yet) — silently
        // skip; the visual list update still surfaces the alert.
      }
    }

    async function poll(): Promise<void> {
      try {
        const res = await fetch('/api/admin/operator/alerts', {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const body = (await res.json()) as {
          alerts?: Array<{ id: string; eventType: string }>;
        };
        const incoming = body.alerts ?? [];
        let freshEmergency = false;
        for (const a of incoming) {
          if (seenAlertIdsRef.current.has(a.id)) continue;
          seenAlertIdsRef.current.add(a.id);
          if (EMERGENCY_TYPES.has(a.eventType)) freshEmergency = true;
        }
        if (freshEmergency && !mutedRef.current) {
          playBeep();
        }
      } catch {
        // Network blip — skip this tick. Next poll catches up.
      }
    }
    const id = window.setInterval(poll, 15_000);
    return () => window.clearInterval(id);
  }, []);

  const alerts = initialAlerts.map((a) =>
    sessionResolved.has(a.id) ? { ...a, isResolved: true } : a,
  );

  const filteredAlerts = alerts.filter(
    (a) =>
      matchesFamily(a.eventType, family) &&
      (!unresolvedOnly || !a.isResolved),
  );

  const openRoster = async (a: OperatorBoardAlert): Promise<void> => {
    setOpenAlert(a);
    setRoster(null);
    setActions([]);
    setActionNote('');
    setEditingPhone(false);
    setPhoneDraft('');
    setPhoneError(null);
    setLoading(true);
    try {
      const [rosterRes, actionsRes] = await Promise.all([
        fetch(`/api/admin/operator/lookup?deviceId=${encodeURIComponent(a.deviceId)}`, {
          cache: 'no-store',
        }),
        fetch(`/api/admin/operator/action?eviewEventId=${encodeURIComponent(a.id)}`, {
          cache: 'no-store',
        }),
      ]);
      if (rosterRes.ok) {
        setRoster((await rosterRes.json()) as RosterEnrichment);
      }
      if (actionsRes.ok) {
        const body = (await actionsRes.json()) as { actions: OperatorActionRow[] };
        setActions(body.actions);
      }
    } finally {
      setLoading(false);
    }
  };

  const submitPhoneEdit = async (): Promise<void> => {
    if (!openAlert) return;
    const trimmed = phoneDraft.trim();
    setPhoneBusy(true);
    setPhoneError(null);
    try {
      const res = await fetch(
        `/api/admin/devices/${encodeURIComponent(openAlert.deviceId)}/phone`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumber: trimmed.length > 0 ? trimmed : null }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setPhoneError(body.message ?? `Backend respondió ${res.status}.`);
        return;
      }
      const updated = (await res.json()) as { phoneNumber: string | null };
      // Mirror the new phone into the local roster so the modal updates
      // immediately — no need to reopen.
      setRoster((prev) =>
        prev
          ? {
              ...prev,
              devices: prev.devices.map((d) =>
                d.deviceId === openAlert.deviceId
                  ? { ...d, phoneNumber: updated.phoneNumber }
                  : d,
              ),
            }
          : prev,
      );
      setEditingPhone(false);
      setPhoneDraft('');
    } catch (err) {
      setPhoneError(err instanceof Error ? err.message : String(err));
    } finally {
      setPhoneBusy(false);
    }
  };

  // Auto-clear the pending-close prompt after 6 s so a staged confirm
  // never leaves a dangling "click again to confirm" button if the
  // dispatcher walks away mid-flow.
  useEffect(() => {
    if (!pendingClose) return;
    const t = window.setTimeout(() => setPendingClose(null), 6_000);
    return () => window.clearTimeout(t);
  }, [pendingClose]);

  // Reset pendingClose whenever the modal closes — a staged confirm
  // for one alert must never silently fire on the NEXT alert opened.
  useEffect(() => {
    if (!openAlert) setPendingClose(null);
  }, [openAlert]);

  // Wrapper called by every preset button. For CONFIRM_REQUIRED kinds,
  // first click stages; second click (within 6 s) fires. For
  // everything else, fires immediately.
  const handlePresetClick = (kind: ActionKind): void => {
    if (CONFIRM_REQUIRED.has(kind)) {
      if (pendingClose === kind) {
        setPendingClose(null);
        void recordAction(kind);
      } else {
        setPendingClose(kind);
      }
      return;
    }
    void recordAction(kind);
  };

  const recordAction = async (kind: ActionKind): Promise<void> => {
    if (!openAlert) return;
    setActionBusy(kind);
    try {
      const res = await fetch('/api/admin/operator/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eviewEventId: openAlert.id,
          kind,
          note: actionNote.trim() ? actionNote.trim() : undefined,
        }),
      });
      if (res.ok) {
        const body = (await res.json()) as { action: OperatorActionRow };
        setActions((prev) => [...prev, body.action]);
        setActionNote('');
        // Both RESOLVED and FALSE_ALARM close the alert from the
        // dispatcher's perspective — the queue's session-resolved
        // overlay marks the row as handled either way so the same
        // event doesn't flicker back to "unresolved" until the
        // server refresh catches up.
        if ((kind === 'RESOLVED' || kind === 'FALSE_ALARM') && openAlert) {
          const resolvedId = openAlert.id;
          setSessionResolved((prev) => {
            const next = new Set(prev);
            next.add(resolvedId);
            return next;
          });
        }
      }
    } finally {
      setActionBusy(null);
    }
  };

  const telHref = `tel:${auraCallNumber.replace(/\s+/g, '')}`;

  // Map-marker click → reuse the queue's roster modal opener so the
  // dispatcher lands in the exact same context regardless of entry
  // point. If the event is outside the current queue page we silently
  // no-op (v1 trade-off — pagination jump deferred until the queue
  // grows past 20 rows in real prod traffic).
  const onMapMarkerClick = (eventId: string): void => {
    const match = initialAlerts.find((a) => a.id === eventId);
    if (match) void openRoster(match);
  };

  return (
    <div className="mt-8">
      <OperatorPresencePanel rows={initialPresence} />
      <OperatorMapClient
        alerts={initialMapAlerts}
        presence={initialPresence}
        onMarkerClick={onMapMarkerClick}
      />
      <div
        data-testid="admin-operator-filters"
        className="mt-6 mb-4 flex flex-wrap items-center gap-2"
      >
        {FAMILY_CHIPS.map((chip) => {
          const active = family === chip.key;
          return (
            <button
              key={chip.key}
              type="button"
              data-testid={`admin-operator-filter-${chip.key}`}
              aria-pressed={active}
              onClick={() => setFamily(chip.key)}
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                active
                  ? 'bg-zinc-900 text-white'
                  : 'bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50'
              }`}
            >
              {chip.label}
            </button>
          );
        })}
        <span aria-hidden className="mx-1 h-4 w-px bg-zinc-200" />
        <button
          type="button"
          data-testid="admin-operator-filter-unresolved"
          aria-pressed={unresolvedOnly}
          onClick={() => setUnresolvedOnly((v) => !v)}
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
            unresolvedOnly
              ? 'bg-emerald-600 text-white'
              : 'bg-white text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50'
          }`}
        >
          Sin resolver
        </button>
        <BulkResolveButton />
        <button
          type="button"
          data-testid="admin-operator-mute"
          aria-pressed={muted}
          onClick={() => setMuted((v) => !v)}
          title={
            muted
              ? 'Sonido apagado para alertas nuevas'
              : 'Sonido activo para alertas nuevas'
          }
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
            muted
              ? 'bg-white text-zinc-500 ring-1 ring-zinc-200 hover:bg-zinc-50'
              : 'bg-sensu-50 text-sensu-700 ring-1 ring-sensu-200 hover:bg-sensu-100'
          }`}
        >
          {muted ? (
            <LuVolumeOff aria-hidden className="h-3.5 w-3.5" />
          ) : (
            <LuVolume2 aria-hidden className="h-3.5 w-3.5" />
          )}
          {muted ? 'Silenciado' : 'Sonido'}
        </button>
      </div>

      {alerts.length === 0 ? (
        <p
          data-testid="admin-operator-empty"
          className="rounded-3xl bg-white p-8 text-sm text-zinc-500 ring-1 ring-zinc-200"
        >
          No hay alertas accionables todavía. Cuando alguna Angela dispara un
          SOS, una caída o una geocerca, aparece aquí en tiempo real.
        </p>
      ) : filteredAlerts.length === 0 ? (
        <p
          data-testid="admin-operator-empty-filtered"
          className="rounded-3xl bg-white p-8 text-sm text-zinc-500 ring-1 ring-zinc-200"
        >
          No hay alertas que coincidan con los filtros activos. Ajusta los
          chips de arriba para ampliar la búsqueda.
        </p>
      ) : (
        <>
        <PaginationNav
          {...pagination}
          testIdPrefix="admin-operator-pagination"
          position="top"
        />
        <ul data-testid="admin-operator-list" className="grid gap-2">
          {filteredAlerts.map((a) => {
            const tone = EVENT_TONE[a.eventType] ?? {
              dot: 'bg-zinc-400',
              chip: 'bg-zinc-100 text-zinc-700 ring-zinc-200',
              label: a.eventType,
            };
            return (
              <li
                key={a.id}
                data-testid={`admin-operator-row-${a.id}`}
                data-resolved={a.isResolved ? 'true' : 'false'}
                data-event-type={a.eventType}
              >
                <button
                  type="button"
                  onClick={() => void openRoster(a)}
                  className={`card-surface flex w-full min-w-0 items-center gap-4 rounded-2xl p-4 text-left transition-transform hover:-translate-y-0.5 cursor-pointer ${
                    a.isResolved ? 'opacity-60' : ''
                  }`}
                >
                  <span
                    aria-hidden
                    className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${tone.dot}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${tone.chip}`}
                      >
                        {tone.label}
                      </span>
                      <span className="truncate text-sm font-semibold tracking-tight text-zinc-900">
                        {a.deviceLabel}
                      </span>
                      {a.isResolved ? (
                        <span
                          data-testid={`operator-resolved-badge-${a.id}`}
                          className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200"
                        >
                          <LuCheck className="h-3 w-3" />
                          Resuelto
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 block text-xs text-zinc-500">
                      {a.customerSummary?.seniorName ?? 'Sin titular asignado'}
                      {' · '}
                      <span className="tabular-nums">{formatTime(a.timestamp)}</span>
                      {a.batteryLevel !== null ? (
                        <>
                          {' · '}
                          <LuBattery className="inline h-3 w-3 align-text-bottom" />{' '}
                          {a.batteryLevel}%
                        </>
                      ) : null}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <PaginationNav
          {...pagination}
          testIdPrefix="admin-operator-pagination"
          position="bottom"
        />
        </>
      )}

      <Modal
        open={openAlert !== null}
        onClose={() => setOpenAlert(null)}
        title={
          openAlert
            ? `${EVENT_TONE[openAlert.eventType]?.label ?? openAlert.eventType} · ${openAlert.deviceLabel}`
            : 'Detalle'
        }
        testId="admin-operator-modal"
        size="lg"
      >
        {openAlert ? (
          <div className="space-y-5">
            <p className="text-xs text-zinc-500">
              IMEI <span className="font-mono">{openAlert.deviceId}</span>
              {' · '}
              {formatTime(openAlert.timestamp)}
            </p>
            {(() => {
              // Pull out the device-side details so the dispatcher sees the
              // pendant's own phone (to call the senior back through the
              // device speaker) and the exact lat/lng captured at alarm time.
              // The section ALWAYS renders when a matched device is in the
              // roster so the operator can backfill the phone inline on
              // pre-existing devices that were activated before the field
              // existed.
              const matchedDevice = roster?.devices.find(
                (d) => d.deviceId === openAlert.deviceId,
              );
              if (!matchedDevice) return null;
              const hasPhone = !!matchedDevice.phoneNumber;
              const hasGps =
                typeof openAlert.lat === 'number' &&
                typeof openAlert.lng === 'number' &&
                Number.isFinite(openAlert.lat) &&
                Number.isFinite(openAlert.lng);
              return (
                <section
                  data-testid="admin-operator-modal-device"
                  className="rounded-2xl bg-zinc-50 p-4 ring-1 ring-zinc-200/70"
                >
                  <p className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-zinc-500">
                    <LuPhone className="h-4 w-4 text-sky-500" />
                    Dispositivo
                  </p>

                  {editingPhone ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <input
                        type="tel"
                        data-testid="admin-operator-modal-device-phone-input"
                        value={phoneDraft}
                        onChange={(e) => setPhoneDraft(e.target.value)}
                        placeholder="+52 55 1234 5678"
                        autoComplete="off"
                        spellCheck={false}
                        className="flex-1 min-w-40 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-sensu-400 focus:ring-2 focus:ring-sensu-200"
                      />
                      <button
                        type="button"
                        data-testid="admin-operator-modal-device-phone-save"
                        onClick={() => void submitPhoneEdit()}
                        disabled={phoneBusy}
                        className="inline-flex items-center rounded-full bg-sensu-500 px-3 py-1.5 text-xs font-medium tracking-tight text-white transition-transform hover:-translate-y-0.5 active:scale-[0.98] disabled:cursor-progress disabled:opacity-60 disabled:hover:translate-y-0 cursor-pointer"
                      >
                        {phoneBusy ? 'Guardando…' : 'Guardar'}
                      </button>
                      <button
                        type="button"
                        data-testid="admin-operator-modal-device-phone-cancel"
                        onClick={() => {
                          setEditingPhone(false);
                          setPhoneDraft('');
                          setPhoneError(null);
                        }}
                        disabled={phoneBusy}
                        className="inline-flex items-center rounded-full bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 ring-1 ring-zinc-300 hover:bg-zinc-50 disabled:opacity-50 cursor-pointer"
                      >
                        Cancelar
                      </button>
                      {phoneError ? (
                        <p
                          data-testid="admin-operator-modal-device-phone-error"
                          className="basis-full text-xs text-rose-700"
                        >
                          {phoneError}
                        </p>
                      ) : null}
                    </div>
                  ) : hasPhone ? (
                    <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zinc-700">
                      <span>Llamar al pendant:</span>
                      <a
                        data-testid="admin-operator-modal-device-phone"
                        href={`tel:${matchedDevice.phoneNumber!.replace(/\s+/g, '')}`}
                        className="font-medium text-sky-700 underline-offset-2 hover:underline"
                      >
                        {matchedDevice.phoneNumber}
                      </a>
                      <button
                        type="button"
                        data-testid="admin-operator-modal-device-phone-edit"
                        aria-label="Editar número del pendant"
                        onClick={() => {
                          setPhoneDraft(matchedDevice.phoneNumber ?? '');
                          setEditingPhone(true);
                        }}
                        className="inline-flex items-center rounded-full bg-white px-2 py-1 text-[11px] font-medium text-zinc-600 ring-1 ring-zinc-300 hover:bg-zinc-50 cursor-pointer"
                      >
                        <LuPencil className="h-3 w-3" />
                      </button>
                    </p>
                  ) : (
                    <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zinc-700">
                      <span className="text-zinc-500">Sin número asignado al pendant.</span>
                      <button
                        type="button"
                        data-testid="admin-operator-modal-device-phone-add"
                        onClick={() => {
                          setPhoneDraft('');
                          setEditingPhone(true);
                        }}
                        className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-sky-700 ring-1 ring-sky-200 hover:bg-sky-50 cursor-pointer"
                      >
                        <LuPencil className="h-3 w-3" /> Agregar número
                      </button>
                    </p>
                  )}

                  {hasGps ? (
                    <p className="mt-2 text-xs text-zinc-700">
                      <LuMapPin className="inline h-3 w-3" />{' '}
                      Ubicación al disparar la alarma:{' '}
                      <a
                        data-testid="admin-operator-modal-alert-gps"
                        href={`https://www.google.com/maps?q=${openAlert.lat},${openAlert.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sky-700 underline-offset-2 hover:underline tabular-nums"
                      >
                        {openAlert.lat!.toFixed(5)}, {openAlert.lng!.toFixed(5)}
                      </a>
                    </p>
                  ) : null}
                  <p className="mt-3 text-xs">
                    <a
                      data-testid="admin-operator-modal-device-timeline"
                      href={`/admin/devices/${encodeURIComponent(openAlert.deviceId)}`}
                      className="inline-flex items-center gap-1 text-sensu-700 underline-offset-2 hover:underline"
                    >
                      Ver línea de tiempo del dispositivo →
                    </a>
                  </p>
                </section>
              );
            })()}
            {loading ? (
              <p className="text-sm text-zinc-500">Cargando ficha del titular…</p>
            ) : roster ? (
              <>
                {roster.managedFleet ? (
                  // Industrial-fleet rail: the matched device's
                  // MASTER is a worker, not a senior. Swap labels,
                  // hide the senior-only medical block, and show the
                  // employing company so the dispatcher does not
                  // confuse the shared company roster below with a
                  // personal family contact list.
                  <section
                    data-testid="admin-operator-modal-managed-worker"
                    className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200/70"
                  >
                    <p className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-amber-700">
                      <LuShield className="h-4 w-4" />
                      Trabajador · flota industrial
                    </p>
                    <p
                      data-testid="admin-operator-modal-worker-name"
                      className="mt-2 text-sm font-semibold text-zinc-900"
                    >
                      {roster.managedFleet.workerFullName ?? '—'}
                    </p>
                    <p
                      data-testid="admin-operator-modal-worker-company"
                      className="mt-1 text-xs font-medium text-amber-800"
                    >
                      Empresa: {roster.managedFleet.companyName}
                    </p>
                    {roster.managedFleet.jobTitle || roster.managedFleet.employeeId ? (
                      <p className="mt-1 text-xs text-zinc-700">
                        {roster.managedFleet.jobTitle ?? ''}
                        {roster.managedFleet.jobTitle && roster.managedFleet.employeeId ? ' · ' : ''}
                        {roster.managedFleet.employeeId
                          ? `ID ${roster.managedFleet.employeeId}`
                          : ''}
                      </p>
                    ) : null}
                  </section>
                ) : (
                  <section className="rounded-2xl bg-zinc-50 p-4 ring-1 ring-zinc-200/70">
                    <p className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-zinc-500">
                      <LuShield className="h-4 w-4 text-sensu-500" />
                      Adulto mayor
                    </p>
                    <p
                      data-testid="admin-operator-modal-senior-name"
                      className="mt-2 text-sm font-semibold text-zinc-900"
                    >
                      {roster.careRecipient?.fullName ?? '—'}
                    </p>
                    <p className="mt-1 text-xs text-zinc-700">
                      <LuPhone className="inline h-3 w-3" />{' '}
                      {roster.careRecipient?.phone ?? '—'}
                      {roster.careRecipient?.age !== null && roster.careRecipient?.age !== undefined ? (
                        <> · {roster.careRecipient.age} años</>
                      ) : null}
                    </p>
                    <p className="mt-1 break-words text-xs text-zinc-600">
                      <LuMapPin className="inline h-3 w-3" />{' '}
                      {roster.careRecipient?.address ?? '—'}
                    </p>
                    {roster.careRecipient?.medicalConditions ? (
                      <p className="mt-2 text-xs leading-snug text-zinc-700">
                        <span className="font-medium">Médico:</span>{' '}
                        {roster.careRecipient.medicalConditions}
                      </p>
                    ) : null}
                    {roster.careRecipient?.auraIdentifier ? (
                      <p className="mt-2 font-mono text-[11px] text-zinc-500">
                        Aura ID: {roster.careRecipient.auraIdentifier}
                      </p>
                    ) : null}
                  </section>
                )}

                <section className="rounded-2xl bg-zinc-50 p-4 ring-1 ring-zinc-200/70">
                  <p className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-zinc-500">
                    <LuMail className="h-4 w-4 text-sky-500" />
                    Titular de la cuenta
                  </p>
                  <p className="mt-2 break-all text-sm text-zinc-900">
                    {roster.accountOwner?.email ?? '—'}
                  </p>
                  <p className="mt-1 text-xs text-zinc-700">
                    {roster.accountOwner?.phone ?? '—'}
                  </p>
                </section>

                {roster.emergencyContacts.length > 0 ? (
                  <section
                    data-testid="admin-operator-modal-emergency-contacts"
                    className="rounded-2xl bg-zinc-50 p-4 ring-1 ring-zinc-200/70"
                  >
                    <p className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-zinc-500">
                      <LuTriangleAlert className="h-4 w-4 text-rose-500" />
                      {roster.managedFleet
                        ? `Contactos compartidos · ${roster.managedFleet.companyName}`
                        : 'Contactos de emergencia'}
                    </p>
                    <ul className="mt-2 grid gap-2 text-sm">
                      {roster.emergencyContacts.map((c, i) => (
                        <li key={i} className="text-zinc-700">
                          <span className="font-medium text-zinc-900">
                            {c.fullName ?? '—'}
                          </span>{' '}
                          · {c.phone ?? '—'}
                          {c.relationship ? <> · {c.relationship}</> : null}
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                {roster.watchers.length > 0 ? (
                  <section className="rounded-2xl bg-zinc-50 p-4 ring-1 ring-zinc-200/70">
                    <p className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-zinc-500">
                      <LuUsers className="h-4 w-4 text-violet-500" />
                      Observadores
                    </p>
                    <ul className="mt-2 grid gap-2 text-sm">
                      {roster.watchers.map((w, i) => (
                        <li key={i} className="text-zinc-700">
                          <span className="font-medium text-zinc-900">
                            {w.fullName ?? '—'}
                          </span>{' '}
                          · {w.phone ?? '—'} ·{' '}
                          <span className="break-all">{w.email ?? '—'}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                <section
                  data-testid="admin-operator-aura-panel"
                  className="rounded-2xl bg-white p-4 ring-1 ring-rose-200"
                >
                  <p className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-rose-600">
                    <LuSiren className="h-4 w-4 text-rose-500" />
                    Escalar a Aura
                  </p>
                  <p className="mt-2 text-xs leading-snug text-zinc-600">
                    Tras triar la llamada y confirmar que el evento amerita
                    la cadena de asistencia (ambulancia / servicios externos),
                    llama a Aura desde el call-center al número siguiente.
                    Aura coordina el resto.
                  </p>
                  <a
                    href={telHref}
                    data-testid="admin-operator-aura-call-link"
                    className="mt-3 inline-flex items-center gap-2 rounded-full bg-rose-500 px-4 py-2 text-sm font-medium tracking-tight text-white transition-transform hover:-translate-y-0.5 active:scale-[0.98] cursor-pointer"
                  >
                    <LuPhone className="h-4 w-4" />
                    <span
                      data-testid="admin-operator-aura-call-number"
                      className="tabular-nums"
                    >
                      {auraCallNumber}
                    </span>
                  </a>
                </section>

                <section
                  data-testid="admin-operator-actions-panel"
                  className="rounded-2xl bg-zinc-50 p-4 ring-1 ring-zinc-200/70"
                >
                  <p className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-zinc-500">
                    <LuListChecks className="h-4 w-4 text-sensu-500" />
                    Acciones del operador
                  </p>
                  <p className="mt-2 text-xs leading-snug text-zinc-600">
                    Cada paso queda registrado para que el siguiente
                    operador retome el caso sin perder contexto.
                  </p>

                  {actions.length > 0 ? (
                    <ul
                      data-testid="admin-operator-actions-list"
                      className="mt-3 grid gap-2"
                    >
                      {actions.map((a) => (
                        <li
                          key={a.id}
                          data-testid={`admin-operator-action-${a.kind}`}
                          className="flex items-start gap-2 rounded-xl bg-white px-3 py-2 text-sm text-zinc-700 ring-1 ring-zinc-200"
                        >
                          <LuCheck
                            aria-hidden
                            className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500"
                          />
                          <span className="flex-1">
                            <span className="font-medium text-zinc-900">
                              {ACTION_LABEL[a.kind]}
                            </span>
                            {a.note ? (
                              <span className="block text-xs text-zinc-600">
                                {a.note}
                              </span>
                            ) : null}
                            <span className="block text-[11px] text-zinc-500">
                              {a.operator.fullName ?? a.operator.email}
                              {' · '}
                              <span className="tabular-nums">
                                {formatTime(a.createdAt)}
                              </span>
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-xs text-zinc-500">
                      Aún no hay acciones registradas para este evento.
                    </p>
                  )}

                  <textarea
                    data-testid="admin-operator-action-note"
                    value={actionNote}
                    onChange={(e) => setActionNote(e.target.value)}
                    placeholder="Nota opcional (qué dijiste, qué quedó pendiente, etc.)"
                    rows={2}
                    maxLength={2_000}
                    className="mt-4 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300/60"
                  />
                  {/* Call attempts row — neutral pills, fires on
                      single click. The note (if any) attaches to the
                      next preset clicked. */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {CALL_ACTIONS.map((kind) => (
                      <button
                        key={kind}
                        type="button"
                        data-testid={`admin-operator-action-${kind}-btn`}
                        onClick={() => handlePresetClick(kind)}
                        disabled={actionBusy !== null}
                        className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 ring-1 ring-zinc-300 transition-transform hover:-translate-y-0.5 active:scale-[0.98] disabled:cursor-progress disabled:opacity-60 disabled:hover:translate-y-0 cursor-pointer"
                      >
                        {actionBusy === kind ? 'Registrando…' : ACTION_LABEL[kind]}
                      </button>
                    ))}
                    <button
                      type="button"
                      data-testid="admin-operator-action-NOTED-btn"
                      onClick={() => void recordAction('NOTED')}
                      disabled={actionBusy !== null || actionNote.trim().length === 0}
                      className="inline-flex items-center gap-1.5 rounded-full bg-sensu-500 px-3 py-1.5 text-xs font-medium tracking-tight text-white transition-transform hover:-translate-y-0.5 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 cursor-pointer"
                    >
                      {actionBusy === 'NOTED' ? 'Guardando…' : 'Guardar nota'}
                    </button>
                  </div>

                  {/* Closer row — visually separated, requires a
                      two-step confirm because each of these closes
                      the alert from the queue. */}
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-dashed border-zinc-200 pt-3">
                    <span className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                      Cerrar alerta
                    </span>
                    {CLOSE_ACTIONS.map((kind) => {
                      const isPending = pendingClose === kind;
                      const baseClass =
                        kind === 'RESOLVED'
                          ? isPending
                            ? 'bg-emerald-600 text-white ring-emerald-600'
                            : 'bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100'
                          : isPending
                            ? 'bg-amber-600 text-white ring-amber-600'
                            : 'bg-amber-50 text-amber-700 ring-amber-200 hover:bg-amber-100';
                      return (
                        <button
                          key={kind}
                          type="button"
                          data-testid={`admin-operator-action-${kind}-btn`}
                          onClick={() => handlePresetClick(kind)}
                          disabled={actionBusy !== null}
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-transform hover:-translate-y-0.5 active:scale-[0.98] disabled:cursor-progress disabled:opacity-60 disabled:hover:translate-y-0 cursor-pointer ${baseClass}`}
                        >
                          {actionBusy === kind
                            ? 'Registrando…'
                            : isPending
                              ? `Confirmar: ${ACTION_LABEL[kind]}`
                              : ACTION_LABEL[kind]}
                        </button>
                      );
                    })}
                  </div>
                </section>
              </>
            ) : (
              <p className="text-sm text-rose-600">
                No se pudo cargar la ficha del titular. Vuelve a abrirla.
              </p>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function formatLastSeen(iso: string): string {
  const ageMs = Date.now() - new Date(iso).getTime();
  const sec = Math.max(0, Math.round(ageMs / 1_000));
  if (sec < 60) return `visto hace ${sec} s`;
  const min = Math.round(sec / 60);
  return `visto hace ${min} min`;
}

function OperatorPresencePanel({
  rows,
}: {
  rows: OperatorPresence[];
}): React.ReactElement {
  if (rows.length === 0) {
    return (
      <section
        data-testid="operator-presence-panel"
        data-empty="true"
        className="mb-4 flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800 ring-1 ring-amber-200"
      >
        <LuCircleDot aria-hidden className="h-3.5 w-3.5 text-amber-500" />
        Nadie en turno ahora. Abre /admin/operator en otra pestaña para empezar a contar como dispatcher activo.
      </section>
    );
  }
  return (
    <section
      data-testid="operator-presence-panel"
      className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl bg-white px-4 py-3 ring-1 ring-zinc-200"
    >
      <span className="mr-2 flex items-center gap-1.5 text-xs uppercase tracking-[0.16em] text-zinc-500">
        <LuCircleDot aria-hidden className="h-3.5 w-3.5 text-emerald-500" />
        En turno ({rows.length})
      </span>
      {rows.map((r) => (
        <span
          key={r.operatorId}
          data-testid={`operator-presence-row-${r.operatorId}`}
          className="inline-flex items-center gap-1.5 rounded-full bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200"
        >
          <span className="text-zinc-900">{r.fullName ?? r.email}</span>
          <span
            data-testid={`operator-presence-row-${r.operatorId}-load`}
            className="inline-flex items-center rounded-full bg-sensu-50 px-2 py-0.5 text-[10px] font-semibold text-sensu-700 ring-1 ring-sensu-200"
          >
            {r.load} {r.load === 1 ? 'alerta' : 'alertas'}
          </span>
          <span
            data-testid={`operator-presence-row-${r.operatorId}-last-seen`}
            suppressHydrationWarning
            className="text-[11px] text-zinc-500"
          >
            {formatLastSeen(r.lastPingAt)}
          </span>
        </span>
      ))}
    </section>
  );
}
