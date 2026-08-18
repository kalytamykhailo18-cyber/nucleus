import { redirect } from 'next/navigation';
import Link from 'next/link';
import { LuLogOut, LuRadio, LuTriangleAlert } from 'react-icons/lu';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { fetchOperatorBoard } from '@/lib/operator-board';
import { NotificationPermissionGuard } from '@/components/notification-permission-guard';
import { AppOperatorHomeClient } from './operator-home-client';

export const dynamic = 'force-dynamic';

// Spanish labels for the alert types the dispatcher board surfaces.
// Kept local to /app/operator so the family alert-feed rendering
// (which reuses the raw event key) is not affected.
const EVENT_LABEL: Record<string, string> = {
  sos: 'SOS',
  fall_detection: 'Caída detectada',
  battery_low: 'Batería baja',
  geofence_enter: 'Entró en zona',
  geofence_exit: 'Salió de zona',
  button_press: 'Botón lateral',
};

/**
 * Operator home — the compact phone-first surface the call-center
 * operator sees when they open the installed PWA on their phone
 * (Juan 2026-08-04 add-on). Complements the desktop /admin/operator
 * dispatch surface, which stays as-is; this route is optimised for
 * "I stepped away from my desk and my phone just alerted me".
 *
 * Auth: CALLCENTER role only (ADMIN also allowed so a supervisor
 * can install and monitor). USER routes back through /app to their
 * family surface. Anyone else lands on /dashboard.
 *
 * Shift toggle is scaffolded here as UI only; the wiring to a real
 * onShift boolean + the dispatch rule that suppresses standard-tier
 * alerts to off-shift operators lands in Step 5 of the MVP plan.
 * Critical-tier alerts (SOS, fall) will always fan out regardless.
 */
export default async function AppOperatorPage(): Promise<React.ReactElement> {
  const session = await auth();
  const user = session?.user as
    | { id?: string; email?: string; role?: 'USER' | 'ADMIN' | 'CALLCENTER' | 'SALES' }
    | undefined;

  if (!user?.id) {
    redirect('/login?next=/app/operator');
  }
  if (user.role !== 'CALLCENTER' && user.role !== 'ADMIN') {
    redirect('/app');
  }

  const [board, profile] = await Promise.all([
    fetchOperatorBoard(1, 20, { callcenterMode: user.role === 'CALLCENTER' }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { fullName: true, email: true, onShift: true },
    }),
  ]);

  const operatorLabel = profile?.fullName ?? profile?.email ?? 'Operador';
  // ADMIN can visit /app/operator but has no onShift semantics — treat
  // as always on so the toggle renders in the same visual state.
  const initialOnShift = profile?.onShift ?? true;
  const shiftEditable = user.role === 'CALLCENTER';

  return (
    <main
      data-testid="app-operator-page"
      className="flex flex-1 flex-col overflow-x-hidden bg-[#f5f5f7]"
    >
      <header
        data-testid="app-operator-header"
        className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-zinc-200/70 bg-white/95 px-4 py-3 backdrop-blur"
      >
        <div className="flex items-center gap-2 min-w-0">
          <LuRadio aria-hidden className="h-5 w-5 shrink-0 text-sensu-500" />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Sensu · Centro de Monitoreo
            </p>
            <p
              data-testid="app-operator-name"
              className="truncate text-sm font-medium text-zinc-900"
            >
              {operatorLabel}
            </p>
          </div>
        </div>
        <Link
          href="/api/auth/signout"
          data-testid="app-operator-logout"
          aria-label="Cerrar sesión"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 cursor-pointer"
        >
          <LuLogOut aria-hidden className="h-4 w-4" />
        </Link>
      </header>

      <NotificationPermissionGuard />

      <AppOperatorHomeClient
        initialAlerts={board.alerts}
        initialOnShift={initialOnShift}
        shiftEditable={shiftEditable}
      />

      <section
        data-testid="app-operator-recent"
        className="mx-4 mt-4 mb-8 rounded-2xl bg-white p-4 ring-1 ring-zinc-200"
      >
        <div className="mb-3 flex items-center gap-2">
          <LuTriangleAlert aria-hidden className="h-4 w-4 text-rose-500" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Últimas alertas
          </p>
        </div>
        {board.alerts.length === 0 ? (
          <p
            data-testid="app-operator-alerts-empty"
            className="py-4 text-center text-sm text-zinc-500"
          >
            No hay alertas en este momento.
          </p>
        ) : (
          <ul data-testid="app-operator-alerts-list" className="space-y-2">
            {board.alerts.slice(0, 10).map((alert) => {
              // Audit gap 5 (Ustym 2026-08-10): a dispatcher cannot
              // pattern-match on a 15 digit IMEI. Prefer the senior's
              // name, then the account owner, then the device label
              // (never the raw IMEI unless we truly have nothing).
              const primary =
                alert.customerSummary?.seniorName?.trim() ||
                alert.customerSummary?.accountOwnerName?.trim() ||
                alert.deviceLabel;
              const eventLabel = EVENT_LABEL[alert.eventType] ?? alert.eventType;
              return (
                <li
                  key={alert.id}
                  data-testid={`app-operator-alert-${alert.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl bg-zinc-50 px-3 py-2 ring-1 ring-zinc-100"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-900">
                      {primary}
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      {eventLabel} ·{' '}
                      {new Date(alert.timestamp).toLocaleTimeString('es-MX', {
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: 'America/Mexico_City',
                      })}
                    </p>
                  </div>
                  <Link
                    href={`/admin/operator?alert=${alert.id}`}
                    className="inline-flex h-8 shrink-0 items-center rounded-full bg-white px-3 text-xs font-medium text-zinc-700 ring-1 ring-inset ring-zinc-200 transition-transform hover:-translate-y-0.5 hover:bg-zinc-50 active:scale-[0.98] cursor-pointer"
                  >
                    Abrir
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="pb-safe" />
    </main>
  );
}
