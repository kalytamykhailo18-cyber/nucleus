import Link from 'next/link';
import {
  LuActivity,
  LuArrowDown,
  LuArrowUp,
  LuBuilding2,
  LuChartLine,
  LuFilter,
  LuFilterX,
  LuGift,
  LuRadar,
  LuUsers,
} from 'react-icons/lu';
import { SectionLabel } from '@/components/section-label';
import { requireAdmin } from '@/lib/admin';
import { fetchReportingSnapshot } from '@/lib/admin-reporting';
import { resolveStrictAdminView } from '@/lib/admin-view';

export const dynamic = 'force-dynamic';

const ACTION_LABEL: Record<string, string> = {
  CALLED_SENIOR: 'Llamó al adulto mayor',
  CALLED_EMERGENCY_CONTACT: 'Llamó al contacto de emergencia',
  CALLED_FAMILY: 'Llamó a la familia',
  PHONED_AURA: 'Llamó a Aura',
  NOTED: 'Anotó',
  RESOLVED: 'Marcó resuelto',
};

function formatPesos(centavos: number): string {
  const pesos = Math.round(centavos / 100);
  return `$${pesos.toLocaleString('es-MX')}`;
}

function formatPercent(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

/**
 * /admin/reporting — Phase C #5 (2026-06-15).
 *
 * Single-page snapshot of the business: MRR equivalent, subscription
 * counts by status, 30-day signup delta, churn rate, channel
 * attribution, plan distribution, alert volume, and operator activity.
 * Everything derives from existing tables; no new schema, no Stripe
 * call (Stripe is the source of truth for cash, this page is the
 * cohort + lifecycle lens).
 */
export default async function AdminReportingPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string }>;
}): Promise<React.ReactElement> {
  const admin = await requireAdmin();
  const params = await searchParams;
  // Juan 2026-06-23 follow-up: strict is the DEFAULT — see
  // resolveStrictAdminView. Playwright sessions get the opt-out
  // cookie so the spec suite still sees the seeded-demo aggregates.
  const strictView = await resolveStrictAdminView(params.vista);
  const snap = await fetchReportingSnapshot({
    callcenterMode: admin.callcenterMode || strictView,
  });

  const signupsDelta = snap.signups30d - snap.signups60dPrior;
  const signupsDeltaPct = snap.signups60dPrior
    ? (signupsDelta / snap.signups60dPrior) * 100
    : null;

  return (
    <main
      data-testid="admin-reporting-page"
      className="flex flex-1 flex-col items-center px-6 pt-12 pb-12"
    >
      <div className="w-full max-w-5xl">
        <SectionLabel icon={LuChartLine} tone="sensu">
          Administración · Reportes
        </SectionLabel>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900">
            Reporte ejecutivo
          </h1>
          <Link
            href={
              strictView ? '/admin/reporting?vista=all' : '/admin/reporting'
            }
            data-testid="admin-reporting-real-toggle"
            className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium transition-transform hover:-translate-y-0.5 active:scale-[0.98] ${
              strictView
                ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200'
                : 'bg-white text-zinc-700 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50'
            }`}
          >
            {strictView ? (
              <>
                <LuFilterX aria-hidden className="h-4 w-4" />
                Mostrar datos de prueba
              </>
            ) : (
              <>
                <LuFilter aria-hidden className="h-4 w-4" />
                Solo clientes reales
              </>
            )}
          </Link>
        </div>
        <p className="mt-3 text-base text-zinc-500">
          Foto del negocio al{' '}
          {new Date(snap.generatedAt).toLocaleString('es-MX', {
            timeZone: 'America/Mexico_City',
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
          . MRR estimado, suscripciones por estado, atribución de canal y
          actividad del call-center en los últimos 30 días.
        </p>

        {/* Top stat row */}
        <section className="mt-8 grid gap-3 sm:grid-cols-4">
          <Stat
            label="MRR estimado"
            value={formatPesos(snap.mrrEquivalentCentavos)}
            tone="sensu"
            testId="admin-reporting-stat-mrr"
          />
          <Stat
            label="Suscripciones activas"
            value={snap.subscriptionCounts.active.toLocaleString('es-MX')}
            tone="emerald"
            testId="admin-reporting-stat-active"
          />
          <Stat
            label="Pendientes de pago"
            value={snap.subscriptionCounts.pendingPayment.toLocaleString('es-MX')}
            tone={snap.subscriptionCounts.pendingPayment > 0 ? 'amber' : 'emerald'}
            testId="admin-reporting-stat-pending"
          />
          <Stat
            label="Vencidas"
            value={snap.subscriptionCounts.pastDue.toLocaleString('es-MX')}
            tone={snap.subscriptionCounts.pastDue > 0 ? 'rose' : 'emerald'}
            testId="admin-reporting-stat-pastdue"
          />
        </section>

        {/* Second row: cohort + churn */}
        <section className="mt-3 grid gap-3 sm:grid-cols-4">
          <Stat
            label="Registros (30 días)"
            value={snap.signups30d.toLocaleString('es-MX')}
            delta={
              signupsDeltaPct === null
                ? null
                : { value: signupsDelta, pct: signupsDeltaPct }
            }
            tone="sky"
            testId="admin-reporting-stat-signups"
          />
          <Stat
            label="Tasa de churn (30 días)"
            value={formatPercent(snap.churnRate30d)}
            tone={snap.churnRate30d > 0.05 ? 'rose' : 'emerald'}
            testId="admin-reporting-stat-churn"
          />
          <Stat
            label="Alertas en 30 días"
            value={snap.alertVolume30d.toLocaleString('es-MX')}
            tone="rose"
            testId="admin-reporting-stat-alerts"
          />
          <Stat
            label="Leads /contacto (30 días)"
            value={snap.contactInquiries30d.toLocaleString('es-MX')}
            tone="sensu"
            testId="admin-reporting-stat-leads"
          />
        </section>

        {/* Third row: directory totals */}
        <section className="mt-3 grid gap-3 sm:grid-cols-3">
          <Stat
            label="Usuarios totales"
            value={snap.totalUsers.toLocaleString('es-MX')}
            tone="sky"
            icon={LuUsers}
            testId="admin-reporting-stat-users"
          />
          <Stat
            label="Empresas totales"
            value={snap.totalCompanies.toLocaleString('es-MX')}
            tone="sky"
            icon={LuBuilding2}
            testId="admin-reporting-stat-companies"
          />
          <Stat
            label="Empresas con flota administrada"
            value={snap.managedFleetCompanies.toLocaleString('es-MX')}
            tone="sensu"
            icon={LuBuilding2}
            testId="admin-reporting-stat-managed"
          />
        </section>

        {/* Channel attribution */}
        <section
          data-testid="admin-reporting-channels-card"
          className="card-surface mt-10 rounded-3xl p-6"
        >
          <h2 className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
            <LuActivity aria-hidden className="h-3.5 w-3.5 text-sensu-500" />
            Atribución de canal (top 20)
          </h2>
          {snap.channelAttribution.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">
              Sin datos de atribución todavía.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {snap.channelAttribution.map((row) => (
                <li
                  key={row.source}
                  data-testid={`admin-reporting-channel-${row.source}`}
                  className="flex items-center justify-between rounded-2xl bg-zinc-50 px-4 py-2 ring-1 ring-zinc-200/70"
                >
                  <span className="text-sm font-mono text-zinc-700">
                    {row.source}
                  </span>
                  <span className="text-sm font-medium tabular-nums text-zinc-900">
                    {row.count.toLocaleString('es-MX')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Plan distribution */}
        <section
          data-testid="admin-reporting-plans-card"
          className="card-surface mt-6 rounded-3xl p-6"
        >
          <h2 className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
            <LuChartLine aria-hidden className="h-3.5 w-3.5 text-sensu-500" />
            Distribución de planes (activos)
          </h2>
          {snap.planDistribution.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">
              Sin suscripciones activas.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {snap.planDistribution.map((row) => (
                <li
                  key={row.planName}
                  data-testid={`admin-reporting-plan-${row.planName}`}
                  className="flex items-center justify-between rounded-2xl bg-zinc-50 px-4 py-2 ring-1 ring-zinc-200/70"
                >
                  <span className="text-sm text-zinc-800">{row.planName}</span>
                  <span className="text-sm font-medium tabular-nums text-zinc-900">
                    {row.count.toLocaleString('es-MX')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Referral program */}
        <section
          data-testid="admin-reporting-referrals-card"
          className="card-surface mt-6 rounded-3xl p-6"
        >
          <h2 className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
            <LuGift aria-hidden className="h-3.5 w-3.5 text-sensu-500" />
            Programa de referidos
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <Stat
              label="Nuevos referidos (30 días)"
              value={snap.referrals.created30d.toLocaleString('es-MX')}
              tone="sky"
              testId="admin-reporting-stat-referrals-30d"
            />
            <Stat
              label="Pendientes"
              value={snap.referrals.statusCounts.pending.toLocaleString('es-MX')}
              tone="amber"
              testId="admin-reporting-stat-referrals-pending"
            />
            <Stat
              label="Canjeados"
              value={snap.referrals.statusCounts.redeemed.toLocaleString('es-MX')}
              tone="emerald"
              testId="admin-reporting-stat-referrals-redeemed"
            />
            <Stat
              label="Crédito acumulado"
              value={formatPesos(snap.referrals.creditAccruedCentavos)}
              tone="sensu"
              testId="admin-reporting-stat-referrals-credit"
            />
          </div>
          {snap.referrals.statusCounts.expired > 0 && (
            <p
              data-testid="admin-reporting-referrals-expired"
              className="mt-3 text-xs text-zinc-500"
            >
              {snap.referrals.statusCounts.expired.toLocaleString('es-MX')}{' '}
              referidos vencieron sin pago (más de 90 días).
            </p>
          )}
          <h3 className="mt-6 text-xs uppercase tracking-[0.14em] text-zinc-500">
            Top referidores
          </h3>
          {snap.referrals.topReferrers.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">
              Sin canjes registrados todavía.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {snap.referrals.topReferrers.map((row) => (
                <li
                  key={row.userId}
                  data-testid={`admin-reporting-top-referrer-${row.userId}`}
                  className="flex items-center justify-between rounded-2xl bg-zinc-50 px-4 py-2 ring-1 ring-zinc-200/70"
                >
                  <span className="min-w-0 truncate text-sm text-zinc-800">
                    {row.fullName ?? row.email}
                    <span className="ml-2 text-xs text-zinc-500">{row.email}</span>
                  </span>
                  <span className="ml-3 flex shrink-0 items-center gap-3 text-sm font-medium tabular-nums text-zinc-900">
                    <span>
                      {row.redeemedCount.toLocaleString('es-MX')}
                      <span className="ml-1 text-xs text-zinc-500">canjes</span>
                    </span>
                    <span className="text-sensu-700">
                      {formatPesos(row.creditCentavos)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Operator activity */}
        <section
          data-testid="admin-reporting-operator-card"
          className="card-surface mt-6 rounded-3xl p-6"
        >
          <h2 className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
            <LuRadar aria-hidden className="h-3.5 w-3.5 text-sensu-500" />
            Actividad del call-center (30 días)
          </h2>
          {snap.operatorActivity30d.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">
              Sin acciones registradas en los últimos 30 días.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {snap.operatorActivity30d.map((row) => (
                <li
                  key={row.kind}
                  data-testid={`admin-reporting-operator-${row.kind}`}
                  className="flex items-center justify-between rounded-2xl bg-zinc-50 px-4 py-2 ring-1 ring-zinc-200/70"
                >
                  <span className="text-sm text-zinc-800">
                    {ACTION_LABEL[row.kind] ?? row.kind}
                  </span>
                  <span className="text-sm font-medium tabular-nums text-zinc-900">
                    {row.count.toLocaleString('es-MX')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  tone,
  icon: Icon,
  testId,
  delta,
}: {
  label: string;
  value: string;
  tone: 'sensu' | 'sky' | 'emerald' | 'amber' | 'rose';
  icon?: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  testId: string;
  delta?: { value: number; pct: number } | null;
}): React.ReactElement {
  const tones: Record<string, { ring: string; text: string }> = {
    sensu: { ring: 'ring-sensu-200', text: 'text-sensu-700' },
    sky: { ring: 'ring-sky-200', text: 'text-sky-700' },
    emerald: { ring: 'ring-emerald-200', text: 'text-emerald-700' },
    amber: { ring: 'ring-amber-200', text: 'text-amber-700' },
    rose: { ring: 'ring-rose-200', text: 'text-rose-700' },
  };
  const t = tones[tone];
  return (
    <div
      data-testid={testId}
      className={`card-surface flex items-start justify-between rounded-3xl p-5 ring-1 ring-inset ${t.ring}`}
    >
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
          {label}
        </p>
        <p className={`mt-1 text-2xl font-semibold tabular-nums ${t.text}`}>
          {value}
        </p>
        {delta && (
          <p
            className={`mt-1 inline-flex items-center gap-1 text-xs font-medium ${
              delta.value >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {delta.value >= 0 ? (
              <LuArrowUp aria-hidden className="h-3 w-3" />
            ) : (
              <LuArrowDown aria-hidden className="h-3 w-3" />
            )}
            {delta.value > 0 ? '+' : ''}
            {delta.value.toLocaleString('es-MX')} ({delta.pct.toFixed(0)}%)
          </p>
        )}
      </div>
      {Icon && <Icon aria-hidden className={`h-6 w-6 shrink-0 ${t.text}`} />}
    </div>
  );
}
