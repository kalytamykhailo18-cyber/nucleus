import Link from 'next/link';
import {
  LuActivity,
  LuClock,
  LuGauge,
  LuRadioTower,
  LuTriangleAlert,
  LuTruck,
} from 'react-icons/lu';
import { SectionLabel } from '@/components/section-label';
import { requireAdmin } from '@/lib/admin';
import { fetchFunnelHealth } from '@/lib/funnel-health';
import { ResendWelcomeButton } from '../registrations/resend-welcome-button';

export const dynamic = 'force-dynamic';

function formatPesos(centavos: number): string {
  if (centavos === 0) return '$0';
  const pesos = Math.round(centavos / 100);
  return `$${pesos.toLocaleString('es-MX')}`;
}

function formatRelative(unit: 'd' | 'h', n: number): string {
  if (!Number.isFinite(n) || n >= Number.MAX_SAFE_INTEGER) return 'sin actividad';
  if (unit === 'd') {
    if (n === 0) return 'hoy';
    if (n === 1) return 'hace 1 día';
    return `hace ${n} días`;
  }
  if (n === 0) return 'esta hora';
  if (n === 1) return 'hace 1 hora';
  if (n < 48) return `hace ${n} horas`;
  return `hace ${Math.floor(n / 24)} días`;
}

/**
 * /admin/funnel — Customer funnel health (Juan 2026-06-30).
 *
 * Single page that surfaces three operational cohorts Juan needs to
 * act on between checking the operator board and the registrations
 * table. Each section is action-first: every row carries the button
 * or deep-link that lets him resolve the row inline, not just observe
 * the count.
 *
 * Strict by default — fixture filter applies through fetchFunnelHealth,
 * so spec / debug accounts do not pollute the operations view. No
 * lenient cookie path: this surface is for production use only.
 */
export default async function AdminFunnelPage(): Promise<React.ReactElement> {
  await requireAdmin();
  const health = await fetchFunnelHealth();

  return (
    <main
      data-testid="admin-funnel-page"
      className="flex flex-1 flex-col items-center px-6 pt-12 pb-12"
    >
      <div className="w-full max-w-5xl">
        <SectionLabel icon={LuGauge} tone="sensu">
          Administración · Salud del funnel
        </SectionLabel>
        <h1 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900">
          Clientes que necesitan tu mano
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Cohortes operativas que generan fricción al cliente o pierden
          ingresos: pendientes de onboarding, sin dispositivo asignado, y
          dispositivos silenciosos. Cada fila tiene una acción inmediata.
        </p>

        {/* KPI tiles --------------------------------------------------- */}
        <section
          data-testid="admin-funnel-kpis"
          className="mt-8 grid gap-3 sm:grid-cols-3"
        >
          <KpiTile
            testId="admin-funnel-kpi-pending"
            icon={LuClock}
            tone="amber"
            label="Cuestionario pendiente"
            count={health.pendingQuestionnaireTotal}
            href="#section-pending"
          />
          <KpiTile
            testId="admin-funnel-kpi-no-device"
            icon={LuTruck}
            tone="sky"
            label="Sin dispositivo"
            count={health.noDeviceTotal}
            href="#section-no-device"
          />
          <KpiTile
            testId="admin-funnel-kpi-silent"
            icon={LuRadioTower}
            tone="rose"
            label="Dispositivo silencioso"
            count={health.silentDevicesTotal}
            href="#section-silent"
          />
        </section>

        {/* Pending questionnaire ------------------------------------- */}
        <SectionHeader
          id="section-pending"
          icon={LuClock}
          tone="text-amber-600"
          title="Cuestionario pendiente"
          subtitle="Pagaron pero no terminaron el formulario inicial. Un correo de recordatorio resuelve la mayoría."
          shownCount={health.pendingQuestionnaire.length}
          totalCount={health.pendingQuestionnaireTotal}
        />
        {health.pendingQuestionnaire.length === 0 ? (
          <EmptyCard
            testId="admin-funnel-pending-empty"
            text="Nadie pendiente más de 24 horas. La pipeline está limpia."
          />
        ) : (
          <ul
            data-testid="admin-funnel-pending-list"
            className="mt-3 space-y-2"
          >
            {health.pendingQuestionnaire.map((r) => (
              <li
                key={r.subscriptionId}
                data-testid={`admin-funnel-pending-${r.subscriptionId}`}
                className="card-surface flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-900">
                    {r.fullName || r.email}
                  </p>
                  <p className="truncate text-xs text-zinc-500">{r.email}</p>
                  <p className="mt-1 text-xs text-amber-700">
                    Esperando {formatRelative('d', r.daysWaiting)}
                  </p>
                </div>
                <ResendWelcomeButton subscriptionId={r.subscriptionId} />
              </li>
            ))}
          </ul>
        )}

        {/* No device assigned ---------------------------------------- */}
        <SectionHeader
          id="section-no-device"
          icon={LuTruck}
          tone="text-sky-600"
          title="Sin dispositivo asignado"
          subtitle="Suscripción activa sin IMEI vinculado. Falta enviar el botón o registrar el envío."
          shownCount={health.noDevice.length}
          totalCount={health.noDeviceTotal}
        />
        {health.noDevice.length === 0 ? (
          <EmptyCard
            testId="admin-funnel-no-device-empty"
            text="Todos los suscriptores activos tienen al menos un dispositivo enlazado."
          />
        ) : (
          <ul
            data-testid="admin-funnel-no-device-list"
            className="mt-3 space-y-2"
          >
            {health.noDevice.map((r) => (
              <li
                key={r.subscriptionId}
                data-testid={`admin-funnel-no-device-${r.subscriptionId}`}
                className="card-surface flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-900">
                    {r.fullName || r.email}
                  </p>
                  <p className="truncate text-xs text-zinc-500">{r.email}</p>
                  <p className="mt-1 text-xs text-sky-700">
                    Activo {formatRelative('d', r.daysSinceActive)} ·{' '}
                    {formatPesos(r.amountPaidCentavos)} pagado
                  </p>
                </div>
                <Link
                  href={`/admin/dispatch?focus=${r.subscriptionId}`}
                  data-testid={`admin-funnel-no-device-${r.subscriptionId}-assign`}
                  className="inline-flex items-center gap-1 rounded-full bg-sensu-500 px-3 py-1.5 text-xs font-medium text-white transition-transform hover:-translate-y-0.5 active:scale-[0.98] cursor-pointer"
                >
                  <LuTruck aria-hidden className="h-3.5 w-3.5" />
                  Asignar IMEI
                </Link>
              </li>
            ))}
          </ul>
        )}

        {/* Silent devices -------------------------------------------- */}
        <SectionHeader
          id="section-silent"
          icon={LuRadioTower}
          tone="text-rose-600"
          title="Dispositivos silenciosos"
          subtitle="Pareados pero sin reportes hace más de 48 horas. Puede ser batería agotada, fuera de cobertura, o falla del dispositivo."
          shownCount={health.silentDevices.length}
          totalCount={health.silentDevicesTotal}
        />
        {health.silentDevices.length === 0 ? (
          <EmptyCard
            testId="admin-funnel-silent-empty"
            text="Todos los dispositivos activos reportaron en las últimas 48 horas."
          />
        ) : (
          <ul
            data-testid="admin-funnel-silent-list"
            className="mt-3 space-y-2"
          >
            {health.silentDevices.map((d) => (
              <li
                key={d.deviceId}
                data-testid={`admin-funnel-silent-${d.deviceId}`}
                className="card-surface flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-900">
                    {d.label || d.deviceId}
                  </p>
                  <p className="truncate text-xs text-zinc-500">
                    {d.ownerFullName || d.ownerEmail || 'Sin titular'} ·{' '}
                    <span className="font-mono">{d.deviceId}</span>
                  </p>
                  <p className="mt-1 inline-flex items-center gap-1 text-xs text-rose-700">
                    <LuTriangleAlert aria-hidden className="h-3 w-3" />
                    Último reporte {formatRelative('h', d.hoursSinceLastPing)}
                  </p>
                </div>
                <Link
                  href={`/admin/operator?focusDevice=${encodeURIComponent(d.deviceId)}`}
                  data-testid={`admin-funnel-silent-${d.deviceId}-timeline`}
                  className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 ring-1 ring-inset ring-zinc-200 transition-colors hover:bg-zinc-50 cursor-pointer"
                >
                  <LuActivity aria-hidden className="h-3.5 w-3.5" />
                  Ver historial
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function EmptyCard({
  testId,
  text,
}: {
  testId: string;
  text: string;
}): React.ReactElement {
  return (
    <p
      data-testid={testId}
      className="mt-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200"
    >
      {text}
    </p>
  );
}

interface KpiTileProps {
  testId: string;
  icon: typeof LuClock;
  tone: 'amber' | 'sky' | 'rose';
  label: string;
  count: number;
  href: string;
}

function KpiTile({
  testId,
  icon: Icon,
  tone,
  label,
  count,
  href,
}: KpiTileProps): React.ReactElement {
  const toneClasses =
    tone === 'amber'
      ? 'bg-amber-50 text-amber-700 ring-amber-200'
      : tone === 'sky'
        ? 'bg-sky-50 text-sky-700 ring-sky-200'
        : 'bg-rose-50 text-rose-700 ring-rose-200';
  return (
    <Link
      href={href}
      data-testid={testId}
      className={`card-surface flex items-center gap-3 rounded-2xl p-4 ring-1 ring-inset transition-transform hover:-translate-y-0.5 ${toneClasses}`}
    >
      <Icon aria-hidden className="h-5 w-5 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-[0.14em] opacity-80">{label}</p>
        <p
          data-testid={`${testId}-count`}
          className="text-2xl font-semibold tabular-nums text-zinc-900"
        >
          {count}
        </p>
      </div>
    </Link>
  );
}

interface SectionHeaderProps {
  id: string;
  icon: typeof LuClock;
  tone: string;
  title: string;
  subtitle: string;
  shownCount: number;
  totalCount: number;
}

function SectionHeader({
  id,
  icon: Icon,
  tone,
  title,
  subtitle,
  shownCount,
  totalCount,
}: SectionHeaderProps): React.ReactElement {
  return (
    <header id={id} className="mt-10 scroll-mt-20">
      <p className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-zinc-500">
        <Icon aria-hidden className={`h-4 w-4 ${tone}`} />
        {title}
        <span className="ml-auto text-zinc-500 normal-case tracking-normal">
          Mostrando {shownCount} de {totalCount}
        </span>
      </p>
      <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>
    </header>
  );
}
