import { redirect } from 'next/navigation';
import { LuBuilding2, LuBattery, LuMapPin, LuTriangleAlert, LuUsers } from 'react-icons/lu';
import { auth } from '@/auth';
import { SectionLabel } from '@/components/section-label';
import { prisma } from '@/lib/db';
import {
  fetchCompanyAdminContext,
  type CompanyMemberRow,
} from '@/lib/companies';
import {
  SharedContactsPanel,
  type SharedContactRow,
} from './shared-contacts-panel';

export const dynamic = 'force-dynamic';

export default async function CompanyDashboardPage(): Promise<React.ReactElement> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect('/login?next=%2Fcompany');

  const ctx = await fetchCompanyAdminContext(userId);
  if (!ctx) redirect('/dashboard');

  const { company, members } = ctx;
  const alertingMembers = members.filter((m) => m.recentAlertCount > 0).length;

  // Industrial-fleet rail: load the shared roster so the HR lead can
  // view + edit the contacts that cover every device in the fleet.
  const sharedContacts: SharedContactRow[] = company.isManagedFleet
    ? (
        await prisma.companyEmergencyContact.findMany({
          where: { companyId: company.id },
          orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
        })
      ).map((c) => ({
        id: c.id,
        fullName: c.fullName,
        phone: c.phone,
        relationship: c.relationship,
        priority: c.priority,
      }))
    : [];

  return (
    <main
      data-testid="company-dashboard"
      className="flex flex-1 flex-col items-center px-6 pt-12 pb-12"
    >
      <div className="w-full max-w-5xl">
        <SectionLabel icon={LuBuilding2} tone="sensu">
          Panel empresarial
        </SectionLabel>
        <h1
          data-testid="company-dashboard-name"
          className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900"
        >
          {company.name}
        </h1>
        <p className="mt-3 text-base text-zinc-500">
          Vista de tu equipo: cada trabajador con su dispositivo, última
          señal, batería y alertas recientes. Las alertas críticas (SOS,
          caídas, batería baja) cuentan los últimos 30 días.
        </p>

        {company.isManagedFleet && (
          <SharedContactsPanel
            workerCount={members.length}
            initial={sharedContacts}
          />
        )}

        <section className="mt-8 grid gap-3 sm:grid-cols-3">
          <StatCard
            label="Trabajadores"
            value={members.length}
            tone="sensu"
            icon={LuUsers}
            testId="company-stat-members"
          />
          <StatCard
            label="Con alertas (30 días)"
            value={alertingMembers}
            tone={alertingMembers > 0 ? 'rose' : 'emerald'}
            icon={LuTriangleAlert}
            testId="company-stat-alerting"
          />
          <StatCard
            label="Sin dispositivo vinculado"
            value={members.filter((m) => !m.primaryDeviceImei).length}
            tone="amber"
            icon={LuMapPin}
            testId="company-stat-unpaired"
          />
        </section>

        <section className="mt-10">
          <SectionLabel icon={LuUsers} tone="sky">
            Trabajadores
          </SectionLabel>
          {members.length === 0 ? (
            <p
              data-testid="company-members-empty"
              className="card-surface mt-4 rounded-3xl px-6 py-10 text-center text-sm text-zinc-500"
            >
              Aún no hay trabajadores en esta empresa. Pide al
              administrador de Sensu que los importe desde el panel de
              empresas.
            </p>
          ) : (
            <ul
              data-testid="company-members-list"
              className="mt-4 space-y-3"
            >
              {members.map((m) => (
                <MemberCard key={m.membershipId} member={m} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  tone,
  icon: Icon,
  testId,
}: {
  label: string;
  value: number;
  tone: 'sensu' | 'sky' | 'emerald' | 'amber' | 'rose';
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  testId: string;
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
      className={`card-surface flex items-center justify-between rounded-3xl p-5 ring-1 ring-inset ${t.ring}`}
    >
      <div>
        <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">{label}</p>
        <p className={`mt-1 text-3xl font-semibold tabular-nums ${t.text}`}>
          {value.toLocaleString('es-MX')}
        </p>
      </div>
      <Icon aria-hidden className={`h-6 w-6 ${t.text}`} />
    </div>
  );
}

function MemberCard({ member }: { member: CompanyMemberRow }): React.ReactElement {
  const battery = member.primaryDeviceBattery;
  const batteryTone =
    battery === null
      ? 'text-zinc-400'
      : battery < 20
        ? 'text-rose-600'
        : battery < 50
          ? 'text-amber-600'
          : 'text-emerald-600';
  const lastSeen = member.primaryDeviceLastSeenAt
    ? new Date(member.primaryDeviceLastSeenAt).toLocaleString('es-MX', {
        timeZone: 'America/Mexico_City',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';
  return (
    <li
      data-testid={`company-member-${member.userId}`}
      className="card-surface flex flex-wrap items-start justify-between gap-4 rounded-2xl p-5"
    >
      <div className="min-w-0">
        <p className="text-base font-medium text-zinc-900">
          {member.fullName ?? member.email}
        </p>
        <p className="mt-0.5 text-xs text-zinc-500">
          {member.email}
          {member.employeeId ? ` · ${member.employeeId}` : ''}
          {member.jobTitle ? ` · ${member.jobTitle}` : ''}
        </p>
        <p className="mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
          <span className="font-mono">
            {member.primaryDeviceImei ?? 'Sin dispositivo'}
          </span>
          {member.primaryDeviceImei && (
            <>
              <span className={`inline-flex items-center gap-1 ${batteryTone}`}>
                <LuBattery aria-hidden className="h-3.5 w-3.5" />
                {battery !== null ? `${battery}%` : '—'}
              </span>
              <span className="inline-flex items-center gap-1">
                <LuMapPin aria-hidden className="h-3.5 w-3.5" />
                {lastSeen}
              </span>
            </>
          )}
        </p>
      </div>
      <div
        data-testid={`company-member-${member.userId}-alerts`}
        className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${
          member.recentAlertCount > 0
            ? 'bg-rose-50 text-rose-700 ring-rose-200'
            : 'bg-emerald-50 text-emerald-700 ring-emerald-200'
        }`}
      >
        {member.recentAlertCount > 0
          ? `${member.recentAlertCount} alerta${member.recentAlertCount === 1 ? '' : 's'} · 30d`
          : 'Sin alertas · 30d'}
      </div>
    </li>
  );
}
