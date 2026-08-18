import {
  LuBellRing,
  LuMapPin,
  LuShieldCheck,
  LuTriangleAlert,
} from 'react-icons/lu';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { LivePulse } from '@/components/live-pulse';
import { DeviceCard } from '@/components/device-card';
import { DevicesEmpty } from '@/components/devices-empty';
import { LiveDeviceMap } from '@/components/live-device-map';
import { SectionLabel } from '@/components/section-label';
import { AlertsFeed } from '@/components/alerts-feed';
import { PushToggle } from '@/components/push-toggle';
import { WelcomePendingDevice } from '@/components/welcome-pending-device';
import { EmergencyContactCard } from '@/components/emergency-contact-card';
import { PushPromptBanner } from '@/components/push-prompt-banner';
import { NotificationPermissionGuard } from '@/components/notification-permission-guard';
import { InstallChip } from '@/components/install-chip';
import { SubscriptionCard } from '@/components/subscription-card';
import { fetchUserDevices } from '@/lib/devices';
import { fetchAlertsForUser } from '@/lib/alerts';
import type { BillingCadence } from '@/lib/plans';

export default async function DashboardPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const sessionRole = (session?.user as { role?: 'USER' | 'ADMIN' | 'CALLCENTER' } | undefined)?.role;

  // Call-center dispatchers belong on /admin/operator, not the family
  // dashboard. Bounce them first so the page below never tries to
  // resolve a customer subscription for a non-customer account.
  if (sessionRole === 'CALLCENTER') {
    redirect('/admin/operator');
  }

  // Company-admin redirect — a user whose only foothold is being the
  // ADMIN of a Company (HR/Safety lead on a managed fleet) belongs on
  // /company, not the personal /dashboard. Global ADMINs are exempt so
  // they can still tour the family surface.
  if (userId && sessionRole !== 'ADMIN') {
    const { resolveLandingPath } = await import('@/lib/post-login-destination');
    const landing = await resolveLandingPath({ userId, role: sessionRole ?? null });
    if (landing === '/company') {
      redirect('/company');
    }
  }

  // Onboarding gate — routes users through the right next step based on
  // their subscription state:
  //   - PENDING_PAYMENT → /checkout (resume the payment they abandoned)
  //   - ACTIVE + !questionnaireCompleted → /onboarding/questionnaire
  //   - ACTIVE + questionnaireCompleted → land here on the dashboard
  //   - no subscription (bare /signup user) → land here on the dashboard
  let latestSubStatus: 'PENDING_PAYMENT' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'PAUSED' | null = null;
  let dbFullName: string | null = null;
  let referralCreditCentavos = 0;
  let activeSub: {
    cadence: BillingCadence | null;
    startDate: Date | null;
    currentPeriodEnd: Date | null;
    planName: string;
  } | null = null;
  if (userId) {
    const me = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        fullName: true,
        questionnaireCompleted: true,
        referralCreditCentavos: true,
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            status: true,
            cadence: true,
            startDate: true,
            currentPeriodEnd: true,
            plan: { select: { name: true } },
          },
        },
      },
    });
    dbFullName = me?.fullName ?? null;
    referralCreditCentavos = me?.referralCreditCentavos ?? 0;
    const latestSub = me?.subscriptions[0];
    latestSubStatus = latestSub?.status ?? null;
    if (latestSub?.status === 'PENDING_PAYMENT') {
      redirect('/checkout');
    }
    if (
      me &&
      !me.questionnaireCompleted &&
      latestSub?.status === 'ACTIVE'
    ) {
      redirect('/onboarding/questionnaire');
    }
    if (latestSub?.status === 'ACTIVE') {
      activeSub = {
        cadence: (latestSub.cadence as BillingCadence | null) ?? null,
        startDate: latestSub.startDate ?? null,
        currentPeriodEnd: latestSub.currentPeriodEnd ?? null,
        planName: latestSub.plan.name,
      };
    }
  }
  const email = session?.user?.email ?? 'desconocido';
  // Read fullName from the User row directly. The JWT freezes the name
  // at sign-in time, so a user who registered then completed the
  // questionnaire later still saw the empty greeting until the next
  // sign-in. Server-side fetch is always fresh.
  const name =
    dbFullName && !dbFullName.includes('@') && dbFullName.trim().length > 0
      ? dbFullName
      : null;
  const greeting = name ? `Hola, ${name.split(' ')[0]}` : 'Hola';

  const [devices, alertsPage] = userId
    ? await Promise.all([
        fetchUserDevices(userId),
        fetchAlertsForUser(userId),
      ])
    : [[], { alerts: [], nextCursor: null }];
  const unreadAlerts = alertsPage.alerts.filter((a) => !a.read).length;

  const cardBase =
    'card-surface card-surface-hoverable rounded-3xl p-6 hover:-translate-y-1';

  return (
    <main
      data-testid="dashboard-page"
      className="flex flex-1 flex-col items-center overflow-x-hidden px-6 pt-12 pb-12"
    >
      <div className="w-full max-w-3xl">
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-zinc-900 animate-fade-up [animation-delay:80ms]">
          {greeting}
        </h1>
        <p className="mt-2 text-base text-zinc-500 animate-fade-up [animation-delay:160ms]">
          Sesión iniciada como{' '}
          <strong
            data-testid="dashboard-email"
            className="font-medium text-zinc-700"
          >
            {email}
          </strong>
          .
        </p>

        {/* Persistent install chip (Ustym 2026-08-10). Real users
            never see the one-shot install bottom-sheet a second time;
            this chip stays visible until they run in standalone mode
            so the install path is always one tap away. */}
        <div className="mt-4 animate-fade-up [animation-delay:200ms]">
          <InstallChip />
        </div>

        {/* Post-purchase welcome — visible only while we still owe the
            family their first device. The call-center assigns one and
            this card disappears the next time the family loads the page. */}
        {latestSubStatus === 'ACTIVE' && devices.length === 0 && (
          <WelcomePendingDevice />
        )}

        {/* SOS escalation reminder — shown whenever the family has at
            least one device so they always know how to reach the
            call-center directly during an emergency. */}
        {devices.length > 0 && <EmergencyContactCard />}

        {/* Push-notifications opt-in nudge (Juan 2026-06-25). Sits
            above the map so a brand-new family sees it the moment
            they land on /dashboard; self-hides for users who already
            subscribed, denied, or dismissed within the past 7 days. */}
        {devices.length > 0 && <PushPromptBanner />}
        {/* Sync-only guard: server permission sync + missed-push
            escalation modal. PushPromptBanner owns the visible
            denied-state pill so the guard skips its own banner via
            variant='sync-only'. Family users on /dashboard used to
            miss the escalation modal after /app/family was killed in
            the 2026-08-10 audit; this restores that coverage. */}
        <NotificationPermissionGuard variant="sync-only" />

        {devices.length > 0 && (
          <section
            data-testid="dashboard-map"
            className="mt-12 animate-fade-up [animation-delay:200ms]"
          >
            <header className="flex items-end justify-between gap-3">
              <SectionLabel icon={LuMapPin} tone="sky">Ubicación en vivo</SectionLabel>
            </header>
            <div className="mt-4">
              <LiveDeviceMap initialDevices={devices} />
            </div>
          </section>
        )}

        <section
          data-testid="dashboard-alerts"
          className="mt-12 animate-fade-up [animation-delay:240ms]"
        >
          <header className="flex flex-wrap items-end justify-between gap-3">
            <SectionLabel icon={LuTriangleAlert} tone="rose">Historial de alertas</SectionLabel>
            <div className="flex items-center gap-3">
              {unreadAlerts > 0 && (
                <p
                  data-testid="dashboard-alerts-unread"
                  className="text-xs text-sensu-600 tabular-nums"
                >
                  {unreadAlerts === 1
                    ? '1 sin leer'
                    : `${unreadAlerts} sin leer`}
                </p>
              )}
              <PushToggle />
            </div>
          </header>
          <div className="mt-4">
            <AlertsFeed
              initialAlerts={alertsPage.alerts}
              initialNextCursor={alertsPage.nextCursor}
            />
          </div>
        </section>

        <section
          data-testid="dashboard-devices"
          className="mt-12 animate-fade-up [animation-delay:280ms]"
        >
          <header className="flex items-end justify-between gap-3">
            <SectionLabel icon={LuBellRing} tone="emerald">Tus dispositivos</SectionLabel>
            {devices.length > 0 && (
              <p
                data-testid="dashboard-devices-count"
                className="text-xs text-zinc-400 tabular-nums"
              >
                {devices.length === 1
                  ? '1 dispositivo'
                  : `${devices.length} dispositivos`}
              </p>
            )}
          </header>
          <div className="mt-4">
            {devices.length === 0 ? (
              <DevicesEmpty />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {devices.map((d, i) => (
                  <DeviceCard
                    key={d.deviceId}
                    device={d}
                    animationDelay={`${i * 60}ms`}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Subscription details — plan name + cadence + next renewal
            date. Juan 2026-06-23 (A.1) asked to move this to the bottom
            so the dashboard greets the family with their devices,
            alerts, and map first, and the billing reminder only
            surfaces after they've scrolled through what matters. */}
        {activeSub?.cadence && (
          <div className="mt-10">
            <SubscriptionCard
              planName={activeSub.planName}
              cadence={activeSub.cadence}
              startDate={activeSub.startDate}
              currentPeriodEnd={activeSub.currentPeriodEnd}
              referralCreditCentavos={referralCreditCentavos}
              animationDelay="180ms"
            />
          </div>
        )}

        <section className="mt-10">
          <div className={`${cardBase} animate-rise [animation-delay:300ms]`}>
            <div className="flex items-center justify-between">
              <SectionLabel icon={LuShieldCheck} tone="emerald">Servicio Sensu</SectionLabel>
              <LivePulse label="24/7 activo" />
            </div>
            <p className="mt-3 text-base text-zinc-700 leading-relaxed">
              Monitoreo activo. Tu familiar está conectado al call center en
              cualquier momento.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
