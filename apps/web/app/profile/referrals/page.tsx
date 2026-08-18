import {
  LuArrowLeft,
  LuCircleCheck,
  LuClock,
  LuGift,
  LuUsers,
} from 'react-icons/lu';
import Link from 'next/link';
import { requireFamilySession } from '@/lib/admin';
import { env } from '@/lib/env';
import { SectionLabel } from '@/components/section-label';
import { fetchReferralPanel } from '@/lib/referrals';
import { ReferralShareButtons } from './referral-share-buttons';

export const dynamic = 'force-dynamic';

/**
 * /profile/referrals — every paying family's referral home.
 * Phase A+ #1, shipped 2026-06-16.
 *
 * Shows the user their unique referral code, a one-click share URL
 * (pre-populated with `?ref=`), the running list of friends who
 * signed up via the code (PENDING or REDEEMED), and the credit
 * accrued on their account. Credit applies against their next
 * renewal cycle automatically.
 */
export default async function ProfileReferralsPage(): Promise<React.ReactElement> {
  const { id: userId } = await requireFamilySession('/profile/referrals');

  const baseUrl = env.AUTH_URL;
  const panel = await fetchReferralPanel({ userId, baseUrl });
  const credit = `$${(panel.totalCreditCentavos / 100).toLocaleString('es-MX')}`;
  const perReferralCredit = `$${(50_000 / 100).toLocaleString('es-MX')}`;

  return (
    <main
      data-testid="profile-referrals-page"
      className="flex flex-1 flex-col items-center px-6 pt-10 pb-12"
    >
      <div className="w-full max-w-3xl">
        <Link
          href="/profile"
          data-testid="profile-referrals-back"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-700"
        >
          <LuArrowLeft aria-hidden className="h-4 w-4" />
          Volver a Perfil
        </Link>

        <SectionLabel icon={LuGift} tone="sensu">
          Programa de referidos
        </SectionLabel>
        <h1 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900">
          Invita a un familiar, gana {perReferralCredit} de crédito
        </h1>
        <p className="mt-3 text-base text-zinc-500">
          Comparte tu código con familiares que también quieran
          monitorear a un adulto mayor. Cuando un amigo se registra y
          completa su primer pago, te acreditamos{' '}
          <span className="font-medium text-zinc-700">
            {perReferralCredit} MXN
          </span>{' '}
          que se aplican automáticamente en tu siguiente renovación.
        </p>

        <section
          data-testid="profile-referrals-code-card"
          className="card-surface mt-8 rounded-3xl p-6 ring-1 ring-inset ring-sensu-200"
        >
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
            Tu código de referido
          </p>
          <p
            data-testid="profile-referrals-code"
            className="mt-2 font-mono text-2xl sm:text-3xl font-semibold tracking-wide text-sensu-700 break-all"
          >
            {panel.code}
          </p>
          <p className="mt-3 text-xs text-zinc-500">Compártelo así:</p>
          <ReferralShareButtons code={panel.code} shareUrl={panel.shareUrl} />
        </section>

        <section className="mt-6 grid gap-3 sm:grid-cols-3">
          <Stat
            label="Crédito acumulado"
            value={credit}
            tone="sensu"
            icon={LuGift}
            testId="profile-referrals-stat-credit"
          />
          <Stat
            label="Pendientes de pago"
            value={panel.pendingCount.toLocaleString('es-MX')}
            tone={panel.pendingCount > 0 ? 'amber' : 'emerald'}
            icon={LuClock}
            testId="profile-referrals-stat-pending"
          />
          <Stat
            label="Referidos exitosos"
            value={panel.redeemedCount.toLocaleString('es-MX')}
            tone="emerald"
            icon={LuCircleCheck}
            testId="profile-referrals-stat-redeemed"
          />
        </section>

        <section className="mt-10">
          <SectionLabel icon={LuUsers} tone="sky">
            Tus referidos
          </SectionLabel>
          {panel.referrals.length === 0 ? (
            <p
              data-testid="profile-referrals-empty"
              className="card-surface mt-4 rounded-3xl px-6 py-10 text-center text-sm text-zinc-500"
            >
              Aún no has referido a nadie. Comparte tu código arriba y
              aparecerán aquí cuando se registren.
            </p>
          ) : (
            <ul
              data-testid="profile-referrals-list"
              className="mt-4 space-y-3"
            >
              {panel.referrals.map((r) => (
                <li
                  key={r.id}
                  data-testid={`profile-referrals-row-${r.id}`}
                  className="card-surface flex flex-wrap items-start justify-between gap-3 rounded-2xl p-5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-900">
                      {r.referredFullName ?? r.referredEmail}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      Se registró el{' '}
                      {new Date(r.createdAt).toLocaleDateString('es-MX', {
                        timeZone: 'America/Mexico_City',
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                      {r.redeemedAt
                        ? ` · Pagó el ${new Date(r.redeemedAt).toLocaleDateString(
                            'es-MX',
                            {
                              timeZone: 'America/Mexico_City',
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            },
                          )}`
                        : ''}
                    </p>
                  </div>
                  <StatusBadge status={r.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function StatusBadge({
  status,
}: {
  status: 'PENDING' | 'REDEEMED' | 'EXPIRED';
}): React.ReactElement {
  const map: Record<string, { tone: string; label: string }> = {
    PENDING: {
      tone: 'bg-amber-50 text-amber-700 ring-amber-200',
      label: 'Pendiente',
    },
    REDEEMED: {
      tone: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
      label: 'Pagó · crédito acreditado',
    },
    EXPIRED: {
      tone: 'bg-zinc-100 text-zinc-600 ring-zinc-200',
      label: 'Expiró',
    },
  };
  const t = map[status];
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${t.tone}`}
    >
      {t.label}
    </span>
  );
}

function Stat({
  label,
  value,
  tone,
  icon: Icon,
  testId,
}: {
  label: string;
  value: string;
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
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
          {label}
        </p>
        <p className={`mt-1 text-2xl font-semibold tabular-nums ${t.text}`}>
          {value}
        </p>
      </div>
      <Icon aria-hidden className={`h-6 w-6 shrink-0 ${t.text}`} />
    </div>
  );
}
