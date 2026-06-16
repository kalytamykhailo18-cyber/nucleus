import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  LuArrowLeft,
  LuCalendarClock,
  LuCircleCheck,
  LuCircleAlert,
  LuExternalLink,
  LuMail,
  LuPhone,
  LuPackage,
  LuRadio,
  LuTag,
  LuTriangleAlert,
  LuUser,
  LuCreditCard,
} from 'react-icons/lu';
import { requireAdmin, fetchSubscriptionDetail } from '@/lib/admin';
import { SectionLabel } from '@/components/section-label';
import { cadenceLabel, type BillingCadence } from '@/lib/plans';

export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  PENDING_PAYMENT: 'bg-amber-50 text-amber-700 ring-amber-200',
  PAST_DUE: 'bg-rose-50 text-rose-700 ring-rose-200',
  CANCELLED: 'bg-zinc-100 text-zinc-600 ring-zinc-200',
};

function formatPesos(centavos: number | null): string {
  if (centavos === null) return '—';
  const major = Math.floor(centavos / 100);
  const minor = Math.abs(centavos % 100)
    .toString()
    .padStart(2, '0');
  return `$${major.toLocaleString('es-MX')}.${minor}`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-MX', {
    timeZone: 'America/Mexico_City',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default async function AdminSubscriptionDetailPage({
  params,
}: {
  params: Promise<{ subscriptionId: string }>;
}): Promise<React.ReactElement> {
  await requireAdmin();
  const { subscriptionId } = await params;
  const detail = await fetchSubscriptionDetail(subscriptionId);
  if (!detail) {
    notFound();
  }

  const stripeCustomerHref = detail.stripeCustomerId
    ? `https://dashboard.stripe.com/customers/${detail.stripeCustomerId}`
    : null;

  return (
    <main
      data-testid="admin-subscription-detail"
      className="flex flex-1 flex-col items-center px-6 pt-12 pb-12"
    >
      <div className="w-full max-w-4xl">
        <Link
          href="/admin/registrations"
          data-testid="admin-subscription-back"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-900"
        >
          <LuArrowLeft aria-hidden className="h-4 w-4" />
          Volver al listado
        </Link>

        <SectionLabel icon={LuUser} tone="sensu">
          Administración · Suscripción
        </SectionLabel>
        <h1
          data-testid="admin-subscription-heading"
          className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900"
        >
          {detail.fullName ?? detail.email}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zinc-500">
          <span data-testid="admin-subscription-email" className="break-all">
            <LuMail aria-hidden className="mr-1 inline h-3 w-3" />
            {detail.email}
          </span>
          {detail.phone && (
            <span data-testid="admin-subscription-phone">
              <LuPhone aria-hidden className="mr-1 inline h-3 w-3" />
              {detail.phone}
            </span>
          )}
          <span
            data-testid="admin-subscription-status"
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_TONE[detail.status] ?? 'bg-zinc-100 text-zinc-700 ring-zinc-200'}`}
          >
            {detail.status}
          </span>
        </div>

        {/* Plan + billing */}
        <section
          data-testid="admin-subscription-plan-card"
          className="card-surface mt-8 rounded-3xl p-6"
        >
          <h2 className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
            <LuTag aria-hidden className="h-3.5 w-3.5 text-sensu-500" />
            Plan y facturación
          </h2>
          <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <Field label="Plan">
              {detail.planName}{' '}
              <span className="text-xs text-zinc-500">
                ({detail.planType})
              </span>
            </Field>
            <Field label="Cadencia">
              {detail.cadence
                ? cadenceLabel(detail.cadence as BillingCadence)
                : '—'}
            </Field>
            <Field label="Total cobrado">
              {formatPesos(detail.amountPaidCentavos)}
            </Field>
            <Field label="Cargo inicial (dispositivo + envío)">
              {formatPesos(detail.initialFeePaidCentavos)}
            </Field>
            <Field label="Próxima renovación">
              {formatDate(detail.currentPeriodEnd)}
            </Field>
            <Field label="Fecha de compra">
              {formatDateTime(detail.purchaseDate)}
            </Field>
          </dl>
        </section>

        {/* Lifecycle */}
        <section
          data-testid="admin-subscription-lifecycle-card"
          className="card-surface mt-6 rounded-3xl p-6"
        >
          <h2 className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
            <LuPackage aria-hidden className="h-3.5 w-3.5 text-sensu-500" />
            Cronología
          </h2>
          <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <Field label="Cuenta creada">
              {formatDateTime(detail.createdAt)}
            </Field>
            <Field label="Suscripción iniciada">
              {formatDateTime(detail.startDate)}
            </Field>
            <Field label="Angela enviada">
              {formatDateTime(detail.shippedAt)}
            </Field>
            <Field label="Dispositivo activado">
              {formatDateTime(detail.activatedAt)}
            </Field>
          </dl>
        </section>

        {/* Devices */}
        <section
          data-testid="admin-subscription-devices-card"
          className="card-surface mt-6 rounded-3xl p-6"
        >
          <h2 className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
            <LuRadio aria-hidden className="h-3.5 w-3.5 text-sensu-500" />
            Dispositivos vinculados · {detail.devices.length}
          </h2>
          {detail.devices.length === 0 ? (
            <p
              data-testid="admin-subscription-devices-empty"
              className="mt-3 text-sm text-zinc-500"
            >
              Aún no hay dispositivos vinculados a esta cuenta.{' '}
              <Link
                href={`/admin/dispatch?focus=${detail.subscriptionId}`}
                className="font-medium text-sensu-600 hover:text-sensu-500"
              >
                Asignar IMEI →
              </Link>
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {detail.devices.map((d) => (
                <li
                  key={d.eviewDeviceId}
                  data-testid={`admin-subscription-device-${d.eviewDeviceId}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-zinc-50 px-4 py-2 ring-1 ring-zinc-200"
                >
                  <span className="font-mono text-sm text-zinc-900">
                    {d.eviewDeviceId}
                  </span>
                  <span className="flex items-center gap-2 text-xs text-zinc-500">
                    {d.label && <span>{d.label}</span>}
                    <span className="rounded-full bg-white px-2 py-0.5 ring-1 ring-zinc-200">
                      {d.role}
                    </span>
                    {d.isPrimary && (
                      <span className="rounded-full bg-sensu-50 px-2 py-0.5 text-sensu-700 ring-1 ring-sensu-200">
                        Primario
                      </span>
                    )}
                    <span>vinculado {formatDate(d.pairedAt)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Promo + attribution */}
        {(detail.promoCode || detail.signupSource) && (
          <section
            data-testid="admin-subscription-attribution-card"
            className="card-surface mt-6 rounded-3xl p-6"
          >
            <h2 className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
              <LuTag aria-hidden className="h-3.5 w-3.5 text-sensu-500" />
              Atribución
            </h2>
            <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              {detail.signupSource && (
                <Field label="Fuente de registro">
                  {detail.signupSource}
                </Field>
              )}
              {detail.promoCode && (
                <>
                  <Field label="Código promocional">{detail.promoCode}</Field>
                  <Field label="Canal del código">
                    {detail.promoChannel ?? '—'}
                  </Field>
                  <Field label="Descuento aplicado">
                    {formatPesos(detail.discountAmountCentavos)}
                  </Field>
                </>
              )}
            </dl>
          </section>
        )}

        {/* Risk signals */}
        <section
          data-testid="admin-subscription-risk-card"
          className="card-surface mt-6 rounded-3xl p-6"
        >
          <h2 className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
            <LuTriangleAlert aria-hidden className="h-3.5 w-3.5 text-sensu-500" />
            Señales de riesgo
          </h2>
          <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <RiskRow
              label="Pagos fallidos (30 días)"
              value={detail.riskSignals.failedPaymentCount30d}
              bad={detail.riskSignals.failedPaymentCount30d > 0}
              testId="admin-subscription-risk-failed-30d"
            />
            <RiskRow
              label="Pagos fallidos (histórico)"
              value={detail.riskSignals.failedPaymentCountAllTime}
              bad={detail.riskSignals.failedPaymentCountAllTime > 0}
              testId="admin-subscription-risk-failed-all"
            />
            <RiskRow
              label="Falla abierta ahora"
              value={detail.riskSignals.hasOpenFailure ? 'Sí' : 'No'}
              bad={detail.riskSignals.hasOpenFailure}
              testId="admin-subscription-risk-open-failure"
            />
            <RiskRow
              label="Días para renovación"
              value={
                detail.riskSignals.daysUntilRenewal === null
                  ? '—'
                  : detail.riskSignals.daysUntilRenewal < 0
                    ? `${Math.abs(detail.riskSignals.daysUntilRenewal)} días vencido`
                    : `${detail.riskSignals.daysUntilRenewal} días`
              }
              bad={
                detail.riskSignals.daysUntilRenewal !== null &&
                detail.riskSignals.daysUntilRenewal < 0
              }
              testId="admin-subscription-risk-days-renewal"
            />
            <RiskRow
              label="Reembolsos acumulados"
              value={formatPesos(detail.riskSignals.totalRefundedCentavos || null)}
              bad={detail.riskSignals.totalRefundedCentavos > 0}
              testId="admin-subscription-risk-refunds"
            />
            <RiskRow
              label="Estado lifecycle"
              value={detail.status}
              bad={
                detail.riskSignals.hasPastDueStatus ||
                detail.riskSignals.hasCancelledStatus
              }
              testId="admin-subscription-risk-status"
            />
          </ul>
        </section>

        {/* Payment history */}
        <section
          data-testid="admin-subscription-payments-card"
          className="card-surface mt-6 rounded-3xl p-6"
        >
          <h2 className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
            <LuCalendarClock aria-hidden className="h-3.5 w-3.5 text-sensu-500" />
            Historial de pagos
          </h2>
          {detail.paymentHistory === null ? (
            <p
              data-testid="admin-subscription-payments-empty"
              className="mt-3 text-sm text-zinc-500"
            >
              Sin cliente Stripe asociado. El historial aparece al completar el
              primer pago.
            </p>
          ) : detail.paymentHistory.length === 0 ? (
            <p
              data-testid="admin-subscription-payments-none"
              className="mt-3 text-sm text-zinc-500"
            >
              Sin intentos de pago registrados todavía.
            </p>
          ) : (
            <ul
              data-testid="admin-subscription-payments-list"
              className="mt-4 divide-y divide-zinc-100"
            >
              {detail.paymentHistory.map((p) => (
                <PaymentRow key={p.id} row={p} />
              ))}
            </ul>
          )}
        </section>

        {/* Stripe deep-link */}
        <section
          data-testid="admin-subscription-stripe-card"
          className="card-surface mt-6 rounded-3xl p-6"
        >
          <h2 className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
            <LuCreditCard aria-hidden className="h-3.5 w-3.5 text-sensu-500" />
            Stripe
          </h2>
          {stripeCustomerHref ? (
            <a
              href={stripeCustomerHref}
              target="_blank"
              rel="noreferrer noopener"
              data-testid="admin-subscription-stripe-link"
              className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-sensu-500 px-4 py-2 text-xs font-medium text-white transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
            >
              Abrir cliente en Stripe
              <LuExternalLink aria-hidden className="h-3 w-3" />
            </a>
          ) : (
            <p
              data-testid="admin-subscription-stripe-empty"
              className="mt-3 text-sm text-zinc-500"
            >
              Esta cuenta aún no tiene un cliente Stripe asociado. Se crea al
              completar el primer pago.
            </p>
          )}
          <p className="mt-3 text-xs text-zinc-500">
            Acciones de cambio (reembolso, pausar, cambiar plan) se gestionan
            desde Stripe por ahora. Esta página ya muestra el estado y la
            historia que la mesa necesita para decidir.
          </p>
        </section>
      </div>
    </main>
  );
}

function RiskRow({
  label,
  value,
  bad,
  testId,
}: {
  label: string;
  value: string | number;
  bad: boolean;
  testId: string;
}): React.ReactElement {
  return (
    <li
      data-testid={testId}
      className={`flex items-center justify-between rounded-2xl px-4 py-3 ring-1 ring-inset ${
        bad
          ? 'bg-rose-50 ring-rose-200'
          : 'bg-emerald-50/60 ring-emerald-200/70'
      }`}
    >
      <span className="flex items-center gap-2 text-xs text-zinc-600">
        {bad ? (
          <LuCircleAlert aria-hidden className="h-3.5 w-3.5 text-rose-500" />
        ) : (
          <LuCircleCheck aria-hidden className="h-3.5 w-3.5 text-emerald-500" />
        )}
        {label}
      </span>
      <span
        className={`text-sm font-medium tabular-nums ${
          bad ? 'text-rose-700' : 'text-emerald-700'
        }`}
      >
        {value}
      </span>
    </li>
  );
}

function PaymentRow({
  row,
}: {
  row: import('@/lib/admin').SubscriptionPaymentRow;
}): React.ReactElement {
  const statusTone: Record<string, string> = {
    succeeded: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    processing: 'bg-amber-50 text-amber-700 ring-amber-200',
    requires_payment_method: 'bg-rose-50 text-rose-700 ring-rose-200',
    requires_action: 'bg-rose-50 text-rose-700 ring-rose-200',
    canceled: 'bg-zinc-100 text-zinc-600 ring-zinc-200',
  };
  const tone =
    statusTone[row.status] ?? 'bg-zinc-100 text-zinc-700 ring-zinc-200';
  const statusLabel: Record<string, string> = {
    succeeded: 'Cobrado',
    processing: 'Procesando',
    requires_payment_method: 'Tarjeta rechazada',
    requires_action: 'Requiere acción',
    canceled: 'Cancelado',
  };
  return (
    <li
      data-testid={`admin-subscription-payment-${row.id}`}
      className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-1 last:pb-1"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-zinc-900 tabular-nums">
          {formatPesos(row.amountCentavos)}
          {row.refundedCentavos > 0 && (
            <span className="ml-2 text-xs font-normal text-rose-600">
              (reembolso {formatPesos(row.refundedCentavos)})
            </span>
          )}
        </p>
        <p className="mt-0.5 text-xs text-zinc-500">
          {formatDateTime(row.createdAt)}
          {row.paymentMethodBrand && row.paymentMethodLast4 && (
            <> · {row.paymentMethodBrand} •••• {row.paymentMethodLast4}</>
          )}
        </p>
        {row.declineReason && (
          <p className="mt-1 text-xs text-rose-700">{row.declineReason}</p>
        )}
      </div>
      <span
        className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${tone}`}
      >
        {statusLabel[row.status] ?? row.status}
      </span>
    </li>
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
    <div>
      <dt className="text-xs uppercase tracking-[0.12em] text-zinc-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-zinc-900 tabular-nums">{children}</dd>
    </div>
  );
}
