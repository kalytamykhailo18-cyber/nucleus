import Link from 'next/link';
import {
  LuCalendarCheck,
  LuClock,
  LuFilter,
  LuFilterX,
  LuPhone,
  LuShield,
  LuUsers,
} from 'react-icons/lu';
import { SectionLabel } from '@/components/section-label';
import { requireCallcenterOrAdmin } from '@/lib/admin';
import { resolveStrictAdminView } from '@/lib/admin-view';
import {
  fetchCheckInQueue,
  todayCheckInDay,
  type CheckInQueueRow,
  type CheckInDay,
  type CheckInTimeOfDay,
} from '@/lib/check-in-queue';

export const dynamic = 'force-dynamic';

const DAY_LABEL: Record<CheckInDay, string> = {
  MONDAY: 'Lunes',
  TUESDAY: 'Martes',
  WEDNESDAY: 'Miércoles',
  THURSDAY: 'Jueves',
  FRIDAY: 'Viernes',
};

const TIME_LABEL: Record<CheckInTimeOfDay, string> = {
  MORNING: 'Mañana',
  AFTERNOON: 'Tarde',
  EVENING: 'Noche',
};

/**
 * /admin/check-ins — call-center queue of weekly Sensu check-ins
 * (Juan asked for this 2026-05-22, shipped 2026-06-16).
 *
 * Every account with `checkInEnabled=true` lands here. Today bubbles
 * to the top so the morning dispatcher knows who to call without
 * trawling the registrations list. The senior's userPhone is the
 * click-to-call number; the account-owner phone is the fallback.
 */
export default async function AdminCheckInsPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string }>;
}): Promise<React.ReactElement> {
  const admin = await requireCallcenterOrAdmin();
  const params = await searchParams;
  // Juan 2026-06-23 follow-up: strict is the DEFAULT — see
  // resolveStrictAdminView. Playwright sessions get the opt-out
  // cookie so the spec suite still sees seeded demo families.
  const strictView = await resolveStrictAdminView(params.vista);
  const rows = await fetchCheckInQueue({
    callcenterMode: admin.callcenterMode || strictView,
  });
  const today = todayCheckInDay();
  const todayRows = today ? rows.filter((r) => r.day === today) : [];
  const upcomingRows = today
    ? rows.filter((r) => r.day !== today)
    : rows;
  const byDay = groupByDay(upcomingRows);

  return (
    <main
      data-testid="admin-check-ins-page"
      className="flex flex-1 flex-col items-center px-6 pt-10 pb-12"
    >
      <div className="w-full max-w-5xl">
        <SectionLabel icon={LuCalendarCheck} tone="sensu">
          Administración · Check-ins
        </SectionLabel>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900">
            Cola de check-ins semanales
          </h1>
          {admin.role === 'ADMIN' && (
            <Link
              href={
                strictView ? '/admin/check-ins?vista=all' : '/admin/check-ins'
              }
              data-testid="admin-check-ins-real-toggle"
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
          )}
        </div>
        <p className="mt-3 text-base text-zinc-500">
          Cada familia que activó el check-in semanal aparece aquí, con
          el día, la franja horaria y el teléfono del usuario para
          llamar. La sección {today ? `"${DAY_LABEL[today]}" (hoy)` : 'de hoy'} aparece arriba; el resto de la semana sigue
          abajo.
        </p>

        <section className="mt-8 grid gap-3 sm:grid-cols-3">
          <Stat
            label="Total con check-in activo"
            value={rows.length}
            tone="sensu"
            testId="admin-check-ins-stat-total"
          />
          <Stat
            label={today ? `Hoy (${DAY_LABEL[today]})` : 'Hoy (fin de semana)'}
            value={todayRows.length}
            tone={todayRows.length > 0 ? 'rose' : 'emerald'}
            testId="admin-check-ins-stat-today"
          />
          <Stat
            label="Resto de la semana"
            value={upcomingRows.length}
            tone="sky"
            testId="admin-check-ins-stat-upcoming"
          />
        </section>

        <section className="mt-10">
          <SectionLabel icon={LuClock} tone="rose">
            {today ? `Hoy · ${DAY_LABEL[today]}` : 'Hoy'}
          </SectionLabel>
          {todayRows.length === 0 ? (
            <p
              data-testid="admin-check-ins-today-empty"
              className="card-surface mt-4 rounded-3xl px-6 py-10 text-center text-sm text-zinc-500"
            >
              {today
                ? `No hay check-ins programados para ${DAY_LABEL[today]}.`
                : 'Hoy es fin de semana — no hay check-ins programados; los check-ins se asignan de lunes a viernes.'}
            </p>
          ) : (
            <>
              <ul
                data-testid="admin-check-ins-today-list"
                className="mt-4 space-y-3"
              >
                {todayRows.slice(0, DAY_ROW_CAP).map((r) => (
                  <Row key={r.userId} row={r} highlight />
                ))}
              </ul>
              {todayRows.length > DAY_ROW_CAP && (
                <p
                  data-testid="admin-check-ins-today-overflow"
                  className="mt-3 text-center text-xs text-zinc-500"
                >
                  Mostrando las primeras {DAY_ROW_CAP} de {todayRows.length}
                  {' '}entradas.
                </p>
              )}
            </>
          )}
        </section>

        {DAY_ORDER.map((day) => {
          const dayRows = byDay[day] ?? [];
          if (dayRows.length === 0) return null;
          if (day === today) return null;
          const visible = dayRows.slice(0, DAY_ROW_CAP);
          return (
            <section key={day} className="mt-10">
              <SectionLabel icon={LuCalendarCheck} tone="sensu">
                {DAY_LABEL[day]}
              </SectionLabel>
              <ul
                data-testid={`admin-check-ins-${day.toLowerCase()}`}
                className="mt-4 space-y-3"
              >
                {visible.map((r) => (
                  <Row key={r.userId} row={r} />
                ))}
              </ul>
              {dayRows.length > DAY_ROW_CAP && (
                <p
                  data-testid={`admin-check-ins-${day.toLowerCase()}-overflow`}
                  className="mt-3 text-center text-xs text-zinc-500"
                >
                  Mostrando las primeras {DAY_ROW_CAP} de {dayRows.length} entradas.
                </p>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}

// Ustym 2026-08-26: cap each day's visible list at 20 rows so the
// page never grows past a handful of screen heights. Overflow renders
// an "and N more" note. The customer base with check-in enabled is
// small today; when a single day sustainedly exceeds 20 rows we
// upgrade the section to full per-day pagination.
const DAY_ROW_CAP = 20;

const DAY_ORDER: CheckInDay[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
];

function groupByDay(
  rows: CheckInQueueRow[],
): Partial<Record<CheckInDay, CheckInQueueRow[]>> {
  const out: Partial<Record<CheckInDay, CheckInQueueRow[]>> = {};
  for (const r of rows) {
    (out[r.day] ??= []).push(r);
  }
  return out;
}

function Row({
  row,
  highlight = false,
}: {
  row: CheckInQueueRow;
  highlight?: boolean;
}): React.ReactElement {
  const callablePhone = row.userPhone || row.ownerPhone;
  return (
    <li
      data-testid={`admin-check-ins-row-${row.userId}`}
      className={`card-surface flex flex-wrap items-start justify-between gap-3 rounded-2xl p-5 ring-1 ring-inset ${
        highlight ? 'ring-rose-200 bg-rose-50/30' : 'ring-zinc-200/70'
      }`}
    >
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-base font-medium text-zinc-900">
          <LuUsers aria-hidden className="h-4 w-4 text-sensu-500" />
          {row.fullName ?? row.email}
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          {DAY_LABEL[row.day]}
          {row.timeOfDay ? ` · ${TIME_LABEL[row.timeOfDay]}` : ''}
          {row.city ? ` · ${row.city}` : ''}
          {row.primaryDeviceImei ? ` · IMEI ${row.primaryDeviceImei}` : ' · sin dispositivo'}
        </p>
        {(row.medicalConditions || row.bloodType) && (
          <p className="mt-2 text-xs text-zinc-600">
            {row.bloodType && (
              <span className="mr-2 inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-rose-700 ring-1 ring-rose-200">
                <LuShield aria-hidden className="h-3 w-3" />
                {row.bloodType}
              </span>
            )}
            {row.medicalConditions && <span>{row.medicalConditions}</span>}
          </p>
        )}
      </div>
      <div className="shrink-0">
        {callablePhone ? (
          <a
            data-testid={`admin-check-ins-row-${row.userId}-call`}
            href={`tel:${callablePhone.replace(/\s/g, '')}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-sensu-500 px-4 text-xs font-medium text-white transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
          >
            <LuPhone aria-hidden className="h-3.5 w-3.5" />
            {callablePhone}
          </a>
        ) : (
          <span className="inline-flex h-9 items-center rounded-full bg-zinc-100 px-3 text-xs text-zinc-500 ring-1 ring-zinc-200">
            Sin teléfono
          </span>
        )}
      </div>
    </li>
  );
}

function Stat({
  label,
  value,
  tone,
  testId,
}: {
  label: string;
  value: number;
  tone: 'sensu' | 'sky' | 'emerald' | 'amber' | 'rose';
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
      <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </p>
      <p className={`text-3xl font-semibold tabular-nums ${t.text}`}>
        {value.toLocaleString('es-MX')}
      </p>
    </div>
  );
}
