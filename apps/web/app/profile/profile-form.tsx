'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  LuCircleAlert,
  LuCircleCheck,
  LuHeartPulse,
  LuHouse,
  LuPhone,
  LuShield,
  LuUser,
  LuUsers,
} from 'react-icons/lu';
import { BLOOD_TYPE_OPTIONS } from '@/lib/blood-type';
import { SectionLabel } from '@/components/section-label';
import { AvatarPicker } from '@/components/avatar-picker';

type Gender = 'MUJER' | 'HOMBRE' | 'OTRO';
type HousingType = 'CASA' | 'DEPARTAMENTO' | 'CONDOMINIO';
type CheckInDay =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY';
type CheckInTimeOfDay = 'MORNING' | 'EVENING';

const GENDER_LABELS: Record<Gender, string> = {
  MUJER: 'Mujer',
  HOMBRE: 'Hombre',
  OTRO: 'Prefiero no decir',
};
const HOUSING_LABELS: Record<HousingType, string> = {
  CASA: 'Casa',
  DEPARTAMENTO: 'Departamento',
  CONDOMINIO: 'Condominio',
};
const CHECK_IN_DAY_LABELS: Record<CheckInDay, string> = {
  MONDAY: 'Lunes',
  TUESDAY: 'Martes',
  WEDNESDAY: 'Miércoles',
  THURSDAY: 'Jueves',
  FRIDAY: 'Viernes',
};
const CHECK_IN_TIME_LABELS: Record<CheckInTimeOfDay, string> = {
  MORNING: 'Por la mañana',
  EVENING: 'Por la tarde',
};

const CURP_REGEX = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/;

interface Profile {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  gender: Gender | null;
  curp: string | null;
  userPhone: string | null;
  address: string | null;
  housingType: HousingType | null;
  livesAlone: boolean | null;
  heightCm: number | null;
  weightKg: number | null;
  bloodType: string | null;
  medicalConditions: string | null;
  insuranceInfo: string | null;
  checkInEnabled: boolean | null;
  checkInDay: CheckInDay | null;
  checkInTimeOfDay: CheckInTimeOfDay | null;
  profileImageUrl: string | null;
  /** Read-only on this surface — saved during questionnaire, edited
   *  through the call-center for now. Listed in the dedicated section
   *  below so the buyer can audit the roster without confusing them
   *  with the senior's own profile fields. */
  emergencyContacts: Array<{
    id: string;
    fullName: string;
    phone: string;
    relationship: string;
    priority: number;
  }>;
}

const fieldBase =
  'h-11 rounded-xl border border-zinc-200 bg-white px-4 text-zinc-900 transition-all duration-200 ease-[cubic-bezier(.32,.72,0,1)] placeholder:text-zinc-400 hover:border-zinc-300 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300/60 disabled:bg-white disabled:text-zinc-500 disabled:border-zinc-100';

const textareaBase =
  'min-h-24 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 transition-all duration-200 ease-[cubic-bezier(.32,.72,0,1)] placeholder:text-zinc-400 hover:border-zinc-300 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300/60 resize-y';

const submitBase =
  'inline-flex h-11 items-center justify-center gap-2 rounded-full bg-sensu-500 px-6 text-sm font-medium tracking-tight text-white transition-transform duration-200 ease-[cubic-bezier(.32,.72,0,1)] hover:-translate-y-0.5 active:scale-[0.98] disabled:cursor-progress disabled:opacity-60 disabled:hover:translate-y-0 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sensu-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f5f5f7]';

export default function ProfileForm() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [draft, setDraft] = useState<Partial<Profile>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const body = (await res.json()) as Profile;
        if (cancelled) return;
        setProfile(body);
        setDraft(body);
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : 'No se pudo cargar el perfil');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (savedAt === null) return;
    const t = setTimeout(() => setSavedAt(null), 4000);
    return () => clearTimeout(t);
  }, [savedAt]);

  function handleChange<K extends keyof Profile>(key: K, value: Profile[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setError(null);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!profile) return;
    setError(null);

    const body: Record<string, unknown> = {};
    for (const k of [
      'fullName',
      'phone',
      'dateOfBirth',
      'gender',
      'curp',
      'userPhone',
      'address',
      'housingType',
      'livesAlone',
      'heightCm',
      'weightKg',
      'bloodType',
      'medicalConditions',
      'insuranceInfo',
      'checkInEnabled',
      'checkInDay',
      'checkInTimeOfDay',
      'profileImageUrl',
    ] as const) {
      if (draft[k] !== profile[k]) {
        body[k] = draft[k] ?? null;
      }
    }

    startTransition(async () => {
      const res = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        setError(err.message ?? `Error al guardar (HTTP ${res.status})`);
        return;
      }
      const updated = (await res.json()) as Profile;
      setProfile(updated);
      setDraft(updated);
      setSavedAt(Date.now());
      // Re-render server components (notably AppHeader) so the
      // trigger avatar + name picks up the new values right away.
      router.refresh();
    });
  }

  if (loadError) {
    return (
      <main
        data-testid="profile-page"
        className="flex flex-1 flex-col items-center px-6 pt-12 pb-12"
      >
        <div className="w-full max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
            Perfil
          </h1>
          <p
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200"
          >
            <LuCircleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
            No pudimos cargar tu perfil: {loadError}
          </p>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main
        data-testid="profile-page"
        className="flex flex-1 flex-col items-center px-6 pt-12 pb-12"
      >
        <div className="w-full max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 animate-fade-up [animation-delay:60ms]">
            Perfil
          </h1>
          <div className="mt-8 grid gap-4">
            <div className="h-11 rounded-xl border border-zinc-100 animate-fade-in" />
            <div className="h-11 rounded-xl border border-zinc-100 animate-fade-in [animation-delay:80ms]" />
            <div className="h-11 rounded-xl border border-zinc-100 animate-fade-in [animation-delay:160ms]" />
          </div>
        </div>
      </main>
    );
  }

  const dirty =
    profile !== null &&
    Object.keys(draft).some(
      (k) =>
        (draft as unknown as Record<string, unknown>)[k] !==
        (profile as unknown as Record<string, unknown>)[k],
    );

  return (
    <main
      data-testid="profile-page"
      className="flex flex-1 flex-col items-center px-6 pt-12 pb-12"
    >
      <div className="w-full max-w-2xl">
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-zinc-900 animate-fade-up [animation-delay:60ms]">
          Perfil
        </h1>
        <p className="mt-2 text-base text-zinc-500 animate-fade-up [animation-delay:120ms]">
          Estos datos viajan con cada alerta para que el call center y los
          paramédicos atiendan a tu familiar más rápido.
        </p>

        {savedAt !== null && (
          <p
            role="status"
            data-testid="profile-saved-notice"
            className="mt-6 flex items-start gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200 animate-fade-in"
          >
            <LuCircleCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            Cambios guardados.
          </p>
        )}

        <form
          onSubmit={handleSubmit}
          aria-label="profile-form"
          className="mt-7 flex flex-col gap-8"
        >
          {/* SECTION 1 — Tu cuenta (buyer-side only) */}
          <section
            data-testid="profile-buyer"
            className="flex flex-col gap-5 animate-fade-up [animation-delay:180ms]"
          >
            <SectionLabel icon={LuUser} tone="sky">Tu cuenta</SectionLabel>
            <p className="text-xs text-zinc-500">
              Datos para identificarte como titular de la cuenta. La
              información del adulto mayor (el usuario de la Angela) está
              en la siguiente sección.
            </p>
            <AvatarPicker
              value={draft.profileImageUrl ?? null}
              name={draft.fullName ?? null}
              email={profile.email}
              onChange={(next) => handleChange('profileImageUrl', next)}
            />
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-zinc-600">Email</span>
              <input
                type="email"
                value={profile.email}
                disabled
                data-testid="profile-email"
                className={fieldBase}
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-zinc-600">Tu teléfono</span>
              <input
                type="tel"
                value={draft.phone ?? ''}
                onChange={(e) => handleChange('phone', e.target.value || null)}
                data-testid="profile-phone"
                className={fieldBase}
              />
              <span className="text-xs text-zinc-500">
                Te llamamos a este número si necesitamos confirmar la entrega o
                hablar contigo sobre la cuenta.
              </span>
            </label>
          </section>

          {/* SECTION 2 — Datos del usuario de la Angela (senior-side) */}
          <section
            data-testid="profile-senior"
            className="flex flex-col gap-5 animate-fade-up [animation-delay:200ms]"
          >
            <SectionLabel icon={LuShield} tone="sensu">
              Datos del usuario de la Angela
            </SectionLabel>
            <p className="text-xs text-zinc-500">
              Datos del adulto mayor que va a usar la Angela. Estos viajan
              con cada alerta para que el call-center identifique a tu
              familiar y los paramédicos lo atiendan más rápido.
            </p>
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-zinc-600">Nombre completo</span>
              <input
                type="text"
                value={draft.fullName ?? ''}
                onChange={(e) => handleChange('fullName', e.target.value || null)}
                data-testid="profile-fullName"
                className={fieldBase}
              />
            </label>
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm">
                <span className="text-zinc-600">Fecha de nacimiento</span>
                <input
                  type="date"
                  value={draft.dateOfBirth ? draft.dateOfBirth.slice(0, 10) : ''}
                  onChange={(e) =>
                    handleChange('dateOfBirth', e.target.value || null)
                  }
                  max={new Date().toISOString().slice(0, 10)}
                  data-testid="profile-dateOfBirth"
                  className={fieldBase}
                />
              </label>
              <label className="flex flex-col gap-2 text-sm">
                <span className="text-zinc-600">Género</span>
                <select
                  value={draft.gender ?? ''}
                  onChange={(e) =>
                    handleChange('gender', (e.target.value || null) as Gender | null)
                  }
                  data-testid="profile-gender"
                  className={fieldBase}
                >
                  <option value="">—</option>
                  {(Object.keys(GENDER_LABELS) as Gender[]).map((g) => (
                    <option key={g} value={g}>
                      {GENDER_LABELS[g]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-zinc-600">CURP</span>
              <input
                type="text"
                value={draft.curp ?? ''}
                onChange={(e) =>
                  handleChange('curp', (e.target.value.toUpperCase() || null) as string | null)
                }
                placeholder="AAAA000000HAAAAA00"
                maxLength={18}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={
                  draft.curp != null &&
                  draft.curp.length === 18 &&
                  !CURP_REGEX.test(draft.curp)
                    ? true
                    : undefined
                }
                data-testid="profile-curp"
                className={`${fieldBase} font-mono`}
              />
              {draft.curp != null &&
                draft.curp.length === 18 &&
                !CURP_REGEX.test(draft.curp) && (
                  <span className="text-xs text-rose-600">Formato inválido.</span>
                )}
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-zinc-600">Teléfono del usuario de la Angela</span>
              <input
                type="tel"
                value={draft.userPhone ?? ''}
                onChange={(e) =>
                  handleChange('userPhone', e.target.value || null)
                }
                data-testid="profile-userPhone"
                className={fieldBase}
              />
              <span className="text-xs text-zinc-500">
                Lo usa el call-center para identificar a tu familiar cuando llama.
              </span>
            </label>
          </section>

          <section
            data-testid="profile-housing"
            className="flex flex-col gap-5 animate-fade-up [animation-delay:220ms]"
          >
            <SectionLabel icon={LuHouse} tone="emerald">Dónde vive</SectionLabel>
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-zinc-600">Dirección completa</span>
              <textarea
                value={draft.address ?? ''}
                onChange={(e) =>
                  handleChange('address', e.target.value || null)
                }
                placeholder="Calle, número, depto, colonia, código postal, ciudad"
                data-testid="profile-address"
                className={textareaBase}
              />
            </label>
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm">
                <span className="text-zinc-600">Vivienda</span>
                <select
                  value={draft.housingType ?? ''}
                  onChange={(e) =>
                    handleChange(
                      'housingType',
                      (e.target.value || null) as HousingType | null,
                    )
                  }
                  data-testid="profile-housingType"
                  className={fieldBase}
                >
                  <option value="">—</option>
                  {(Object.keys(HOUSING_LABELS) as HousingType[]).map((h) => (
                    <option key={h} value={h}>
                      {HOUSING_LABELS[h]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-2 text-sm">
                <span className="text-zinc-600">Vive sola/o</span>
                <span className="inline-flex h-11 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draft.livesAlone === true}
                    onChange={(e) =>
                      handleChange('livesAlone', e.target.checked)
                    }
                    data-testid="profile-livesAlone"
                    className="h-4 w-4 rounded border-zinc-300 text-sensu-500 focus:ring-2 focus:ring-sensu-200"
                  />
                  <span className="text-zinc-700 text-sm">
                    Sí, vive sin compañía permanente
                  </span>
                </span>
              </label>
            </div>
          </section>

          <section className="flex flex-col gap-5 animate-fade-up [animation-delay:240ms]">
            <SectionLabel icon={LuHeartPulse} tone="rose">Datos médicos</SectionLabel>
            <div className="grid gap-5 sm:grid-cols-3">
              <label className="flex flex-col gap-2 text-sm">
                <span className="text-zinc-600">Estatura (cm)</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={300}
                  value={draft.heightCm ?? ''}
                  onChange={(e) =>
                    handleChange(
                      'heightCm',
                      e.target.value === '' ? null : Number(e.target.value),
                    )
                  }
                  data-testid="profile-heightCm"
                  className={fieldBase}
                />
              </label>
              <label className="flex flex-col gap-2 text-sm">
                <span className="text-zinc-600">Peso (kg)</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min={1}
                  max={500}
                  value={draft.weightKg ?? ''}
                  onChange={(e) =>
                    handleChange(
                      'weightKg',
                      e.target.value === '' ? null : Number(e.target.value),
                    )
                  }
                  data-testid="profile-weightKg"
                  className={fieldBase}
                />
              </label>
              <label className="flex flex-col gap-2 text-sm">
                <span className="text-zinc-600">Tipo de sangre</span>
                <select
                  value={draft.bloodType ?? ''}
                  onChange={(e) =>
                    handleChange('bloodType', e.target.value || null)
                  }
                  data-testid="profile-bloodType"
                  className={fieldBase}
                >
                  <option value="">—</option>
                  {BLOOD_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-zinc-600">Condiciones médicas</span>
              <textarea
                value={draft.medicalConditions ?? ''}
                onChange={(e) =>
                  handleChange('medicalConditions', e.target.value || null)
                }
                placeholder="Diabetes, hipertensión, alergias relevantes…"
                data-testid="profile-medicalConditions"
                className={textareaBase}
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span className="text-zinc-600">Seguro médico (opcional)</span>
              <input
                type="text"
                value={draft.insuranceInfo ?? ''}
                onChange={(e) =>
                  handleChange('insuranceInfo', e.target.value || null)
                }
                placeholder="GNP — póliza 264349911"
                data-testid="profile-insuranceInfo"
                className={fieldBase}
              />
            </label>
          </section>

          <section
            data-testid="profile-checkin"
            className="flex flex-col gap-5 animate-fade-up [animation-delay:300ms]"
          >
            <SectionLabel icon={LuPhone} tone="sky">Check-in semanal</SectionLabel>
            <p className="text-xs text-zinc-500">
              El call-center llama una vez por semana a tu familiar para saber
              cómo está. Recomendado para adultos mayores que viven solos.
            </p>
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={draft.checkInEnabled === true}
                onChange={(e) => {
                  handleChange('checkInEnabled', e.target.checked);
                  if (!e.target.checked) {
                    handleChange('checkInDay', null);
                    handleChange('checkInTimeOfDay', null);
                  }
                }}
                data-testid="profile-checkInEnabled"
                className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-sensu-500 focus:ring-2 focus:ring-sensu-200"
              />
              <span className="text-zinc-700">
                Activar el check-in semanal.
              </span>
            </label>
            {draft.checkInEnabled === true && (
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm">
                  <span className="text-zinc-600">Día de la llamada</span>
                  <select
                    value={draft.checkInDay ?? 'WEDNESDAY'}
                    onChange={(e) =>
                      handleChange('checkInDay', e.target.value as CheckInDay)
                    }
                    data-testid="profile-checkInDay"
                    className={fieldBase}
                  >
                    {(Object.keys(CHECK_IN_DAY_LABELS) as CheckInDay[]).map(
                      (d) => (
                        <option key={d} value={d}>
                          {CHECK_IN_DAY_LABELS[d]}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-sm">
                  <span className="text-zinc-600">Hora preferida</span>
                  <select
                    value={draft.checkInTimeOfDay ?? 'MORNING'}
                    onChange={(e) =>
                      handleChange(
                        'checkInTimeOfDay',
                        e.target.value as CheckInTimeOfDay,
                      )
                    }
                    data-testid="profile-checkInTimeOfDay"
                    className={fieldBase}
                  >
                    {(
                      Object.keys(CHECK_IN_TIME_LABELS) as CheckInTimeOfDay[]
                    ).map((t) => (
                      <option key={t} value={t}>
                        {CHECK_IN_TIME_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </section>

          {/* SECTION 6 — Contactos de emergencia (read-only roster) */}
          <section
            data-testid="profile-contacts"
            className="flex flex-col gap-5 animate-fade-up [animation-delay:310ms]"
          >
            <SectionLabel icon={LuUsers} tone="amber">
              Contactos de emergencia
            </SectionLabel>
            <p className="text-xs text-zinc-500">
              A quién llamamos cuando tu familiar pide ayuda. Los registraste
              durante el cuestionario y por ahora se editan con el
              call-center — escríbenos para agregar, quitar o cambiar uno.
            </p>
            {profile.emergencyContacts.length === 0 ? (
              <p
                data-testid="profile-contacts-empty"
                className="rounded-2xl bg-zinc-50 px-4 py-6 text-sm text-zinc-500 ring-1 ring-zinc-200"
              >
                Aún no tienes contactos de emergencia registrados.
              </p>
            ) : (
              <ul className="grid gap-3">
                {profile.emergencyContacts.map((c) => (
                  <li
                    key={c.id}
                    data-testid={`profile-contact-${c.priority}`}
                    className="card-surface rounded-2xl p-4"
                  >
                    <p className="flex items-center justify-between gap-3">
                      <span className="font-medium tracking-tight text-zinc-900">
                        {c.fullName}
                      </span>
                      <span className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                        {c.relationship}
                      </span>
                    </p>
                    <p className="mt-1 text-sm text-zinc-600 tabular-nums">
                      <a
                        href={`tel:${c.phone}`}
                        className="font-mono text-zinc-700 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900"
                      >
                        {c.phone}
                      </a>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {error && (
            <p
              role="alert"
              data-testid="profile-error"
              className="flex items-start gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200 animate-fade-in"
            >
              <LuCircleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
              {error}
            </p>
          )}

          <div className="flex items-center gap-4 animate-fade-up [animation-delay:320ms]">
            <button
              type="submit"
              disabled={isPending || !dirty}
              data-testid="profile-save"
              className={submitBase}
            >
              <LuCircleCheck aria-hidden className="h-4 w-4" />
              {isPending ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
