import { LuCalendarClock, LuReceipt } from 'react-icons/lu';
import { SectionLabel } from '@/components/section-label';
import { ManageSubscriptionButton } from '@/components/manage-subscription-button';
import {
  cadenceLabel,
  nextRenewalAt,
  type BillingCadence,
} from '@/lib/plans';

/**
 * Dashboard subscription card. Shows the active plan name + chosen
 * billing cadence + the next renewal date so the family knows exactly
 * what they signed up for and when the next charge lands.
 *
 * The card hides itself when the user has no cadence on their
 * subscription (legacy single-monthly customers from before the
 * 2026-05-26 pricing pivot) — those rows render the older "Servicio
 * Sensu" tile that already sits on the dashboard.
 */
export function SubscriptionCard({
  planName,
  cadence,
  startDate,
  currentPeriodEnd,
  animationDelay,
}: {
  planName: string;
  cadence: BillingCadence;
  startDate: Date | null;
  currentPeriodEnd: Date | null;
  animationDelay?: string;
}) {
  const renewalAt =
    currentPeriodEnd ?? (startDate ? nextRenewalAt(startDate, cadence) : null);
  const formatter = new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <section
      data-testid="dashboard-subscription"
      className="card-surface rounded-3xl p-6 animate-rise"
      style={animationDelay ? { animationDelay } : undefined}
    >
      <SectionLabel icon={LuReceipt} tone="sensu">
        Tu suscripción
      </SectionLabel>
      <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p
          data-testid="dashboard-subscription-plan"
          className="text-xl font-semibold text-zinc-900"
        >
          {planName}
        </p>
        <p
          data-testid="dashboard-subscription-cadence"
          className="text-sm text-zinc-500"
        >
          Facturación {cadenceLabel(cadence).toLowerCase()}
        </p>
      </div>
      {renewalAt && (
        <p
          data-testid="dashboard-subscription-renewal"
          className="mt-3 flex items-center gap-2 text-sm text-zinc-600"
        >
          <LuCalendarClock aria-hidden className="h-4 w-4 text-zinc-400" />
          <span>
            Próxima renovación:{' '}
            <strong className="font-medium text-zinc-800">
              {formatter.format(renewalAt)}
            </strong>
          </span>
        </p>
      )}
      <ManageSubscriptionButton />
    </section>
  );
}
