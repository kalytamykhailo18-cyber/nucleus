import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  LuArrowLeft,
  LuBattery,
  LuBuilding2,
  LuMapPin,
  LuPhone,
  LuShieldCheck,
  LuTriangleAlert,
  LuUsers,
} from 'react-icons/lu';
import { SectionLabel } from '@/components/section-label';
import { requireAdmin } from '@/lib/admin';
import { prisma } from '@/lib/db';
import {
  fetchCompanyContextById,
  type CompanyMemberRow,
} from '@/lib/companies';

export const dynamic = 'force-dynamic';

/**
 * /admin/companies/[id]
 *
 * Global-admin lens into a single Company (Juan reviewing Medtronic /
 * Pemex). Read-only: workers + their devices + the shared emergency
 * roster. Editing of company meta still lives in the listing's modal;
 * editing of the shared roster still lives on the customer-side
 * /company surface owned by the HR lead.
 */
export default async function AdminCompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactElement> {
  await requireAdmin();
  const { id } = await params;

  const ctx = await fetchCompanyContextById(id);
  if (!ctx) notFound();

  const { company, members } = ctx;
  const alertingMembers = members.filter((m) => m.recentAlertCount > 0).length;

  const sharedContacts = company.isManagedFleet
    ? await prisma.companyEmergencyContact.findMany({
        where: { companyId: company.id },
        orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          fullName: true,
          phone: true,
          relationship: true,
          priority: true,
        },
      })
    : [];

  return (
    <main
      data-testid="admin-company-detail"
      className="flex flex-1 flex-col items-center px-6 pt-10 pb-12"
    >
      <div className="w-full max-w-5xl">
        <Link
          href="/admin/companies"
          data-testid="admin-company-back"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-700"
        >
          <LuArrowLeft aria-hidden className="h-4 w-4" />
          Volver a Empresas
        </Link>

        <SectionLabel icon={LuBuilding2} tone="sensu">
          Administración · Empresa
        </SectionLabel>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1
            data-testid="admin-company-name"
            className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900"
          >
            {company.name}
          </h1>
          {company.isManagedFleet && (
            <span
              data-testid="admin-company-managed-badge"
              className="inline-flex items-center gap-1 rounded-full bg-sensu-50 px-3 py-1 text-xs font-medium text-sensu-700 ring-1 ring-sensu-200"
            >
              <LuShieldCheck aria-hidden className="h-3.5 w-3.5" />
              Flota administrada
            </span>
          )}
          {!company.isActive && (
            <span className="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600 ring-1 ring-zinc-200">
              Inactiva
            </span>
          )}
        </div>

        {(company.contactName || company.contactEmail || company.contactPhone) && (
          <p className="mt-3 text-sm text-zinc-500">
            Contacto: {[company.contactName, company.contactEmail, company.contactPhone]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}

        <section className="mt-8 grid gap-3 sm:grid-cols-3">
          <StatCard
            label="Trabajadores"
            value={members.length}
            tone="sensu"
            icon={LuUsers}
            testId="admin-company-stat-members"
          />
          <StatCard
            label="Con alertas (30 días)"
            value={alertingMembers}
            tone={alertingMembers > 0 ? 'rose' : 'emerald'}
            icon={LuTriangleAlert}
            testId="admin-company-stat-alerting"
          />
          <StatCard
            label="Administradores"
            value={company.adminCount}
            tone="sky"
            icon={LuShieldCheck}
            testId="admin-company-stat-admins"
          />
        </section>

        {company.isManagedFleet && (
          <section className="mt-10">
            <SectionLabel icon={LuPhone} tone="sensu">
              Contactos de emergencia compartidos
            </SectionLabel>
            <p className="mt-2 text-sm text-zinc-500">
              La lista que recibe el call-center cuando cualquier trabajador
              de la flota dispara una alerta. La edición se hace desde el
              panel del responsable de la empresa en /company.
            </p>
            {sharedContacts.length === 0 ? (
              <p
                data-testid="admin-company-contacts-empty"
                className="card-surface mt-4 rounded-3xl px-6 py-10 text-center text-sm text-zinc-500"
              >
                Aún no hay contactos compartidos.
              </p>
            ) : (
              <ul
                data-testid="admin-company-contacts"
                className="mt-4 space-y-3"
              >
                {sharedContacts.map((c) => (
                  <li
                    key={c.id}
                    data-testid={`admin-company-contact-${c.id}`}
                    className="card-surface flex items-center justify-between gap-4 rounded-2xl px-5 py-4"
                  >
                    <div className="min-w-0">
                      <p className="text-base font-medium text-zinc-900">
                        {c.fullName}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {c.phone}
                        {c.relationship ? ` · ${c.relationship}` : ''}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600 ring-1 ring-zinc-200">
                      Prioridad {c.priority}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <section className="mt-10">
          <SectionLabel icon={LuUsers} tone="sky">
            Trabajadores
          </SectionLabel>
          {members.length === 0 ? (
            <p
              data-testid="admin-company-members-empty"
              className="card-surface mt-4 rounded-3xl px-6 py-10 text-center text-sm text-zinc-500"
            >
              Esta empresa todavía no tiene trabajadores.
            </p>
          ) : (
            <ul
              data-testid="admin-company-members"
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
      data-testid={`admin-company-member-${member.userId}`}
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
