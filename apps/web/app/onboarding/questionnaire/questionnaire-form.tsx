'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  LuCircleAlert,
  LuHeartHandshake,
  LuHouse,
  LuPhone,
  LuPlus,
  LuStethoscope,
  LuTrash2,
  LuUser,
} from 'react-icons/lu';

type Gender = 'MUJER' | 'HOMBRE' | 'OTRO';
type HousingType = 'CASA' | 'DEPARTAMENTO' | 'CONDOMINIO';
type CheckInDay =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY';
type CheckInTimeOfDay = 'MORNING' | 'EVENING';

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

type Contact = {
  fullName: string;
  phone: string;
  relationship: string;
};

const HOUSING_LABELS: Record<HousingType, string> = {
  CASA: 'Casa',
  DEPARTAMENTO: 'Departamento',
  CONDOMINIO: 'Condominio',
};

const GENDER_LABELS: Record<Gender, string> = {
  MUJER: 'Mujer',
  HOMBRE: 'Hombre',
  OTRO: 'Prefiero no decir',
};

export function QuestionnaireForm({
  buyerPhone,
  buyerFullName,
}: {
  buyerPhone: string;
  buyerFullName: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Senior personal data
  const [seniorName, setSeniorName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<Gender>('MUJER');
  const [curp, setCurp] = useState('');
  const [userPhone, setUserPhone] = useState('');

  // Mexican CURP: 4 letters + 6 digits (YYMMDD) + H|M + 5 letters
  // + 1 alphanumeric (homonym) + 1 digit (check). 18 chars total.
  const CURP_REGEX = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/;
  const curpValid = CURP_REGEX.test(curp.trim().toUpperCase());

  // Where they live
  const [address, setAddress] = useState('');
  const [housingType, setHousingType] = useState<HousingType>('CASA');
  const [livesAlone, setLivesAlone] = useState(false);

  // Shipping address — defaults to the home address. The buyer toggles this
  // when the Angela needs to land somewhere else (a relative's house, a
  // pickup point, etc.) — Juan's walkthrough 2026-05-18.
  const [useAltShipping, setUseAltShipping] = useState(false);
  const [shippingAddress, setShippingAddress] = useState('');

  // Medical
  const [medicalConditions, setMedicalConditions] = useState('');
  const [insuranceInfo, setInsuranceInfo] = useState('');

  // Optional weekly check-in service. When enabled, day + time of day
  // become required, and the senior phone number becomes required (the
  // call-center needs a number to dial).
  const [checkInEnabled, setCheckInEnabled] = useState(false);
  const [checkInDay, setCheckInDay] = useState<CheckInDay>('WEDNESDAY');
  const [checkInTimeOfDay, setCheckInTimeOfDay] =
    useState<CheckInTimeOfDay>('MORNING');

  // Emergency contacts — buyer's own phone is the natural first contact.
  const [contacts, setContacts] = useState<Contact[]>([
    {
      fullName: buyerFullName,
      phone: buyerPhone,
      relationship: 'Familiar',
    },
  ]);

  function updateContact(i: number, patch: Partial<Contact>): void {
    setContacts((prev) =>
      prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)),
    );
  }

  function addContact(): void {
    if (contacts.length >= 5) return;
    setContacts((prev) => [
      ...prev,
      { fullName: '', phone: '', relationship: '' },
    ]);
  }

  function removeContact(i: number): void {
    setContacts((prev) => prev.filter((_, idx) => idx !== i));
  }

  // When the optional check-in service is enabled, the senior's phone
  // becomes mandatory — the call-center needs a number to dial weekly.
  const seniorPhoneSatisfied =
    !checkInEnabled || userPhone.trim().length > 0;

  // Button enables once every required field has any value AND the
  // CURP, once typed, is a valid 18-char format. Each field that
  // could fail format validation also surfaces an inline rose hint
  // so the family knows exactly what to fix instead of staring at a
  // silently-disabled CTA.
  const altShippingSatisfied =
    !useAltShipping || shippingAddress.trim().length > 0;

  const canSubmit =
    !busy &&
    seniorName.trim().length > 0 &&
    dob.length > 0 &&
    curp.trim().length > 0 &&
    curpValid &&
    address.trim().length > 0 &&
    altShippingSatisfied &&
    seniorPhoneSatisfied &&
    contacts.length > 0 &&
    contacts.every(
      (c) =>
        c.fullName.trim().length > 0 &&
        c.phone.trim().length > 0 &&
        c.relationship.trim().length > 0,
    );

  async function submit(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/onboarding/questionnaire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: seniorName.trim(),
          dateOfBirth: dob,
          gender,
          curp: curp.trim().toUpperCase(),
          userPhone: userPhone.trim() || null,
          address: address.trim(),
          shippingAddress: useAltShipping
            ? shippingAddress.trim()
            : address.trim(),
          housingType,
          livesAlone,
          medicalConditions: medicalConditions.trim() || null,
          insuranceInfo: insuranceInfo.trim() || null,
          checkInEnabled,
          checkInDay: checkInEnabled ? checkInDay : null,
          checkInTimeOfDay: checkInEnabled ? checkInTimeOfDay : null,
          contacts: contacts.map((c) => ({
            fullName: c.fullName.trim(),
            phone: c.phone.trim(),
            relationship: c.relationship.trim(),
          })),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        setError(body.message ?? 'No se pudo guardar el cuestionario.');
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      data-testid="questionnaire-form"
      className="mt-10 space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) void submit();
      }}
    >
      {/* SENIOR PERSONAL DATA ----------------------------------------- */}
      <section className="card-surface rounded-3xl p-6">
        <p className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
          <LuUser aria-hidden className="h-4 w-4 text-violet-500" />
          Datos del usuario de la Angela
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm sm:col-span-2">
            <span className="text-xs uppercase tracking-[0.14em] text-zinc-500">
              Nombre completo del usuario
            </span>
            <input
              type="text"
              data-testid="q-seniorName"
              value={seniorName}
              onChange={(e) => setSeniorName(e.target.value)}
              placeholder="María Pérez González"
              maxLength={120}
              required
              className="mt-1.5 block w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-sensu-400 focus:ring-2 focus:ring-sensu-200"
            />
          </label>

          <label className="text-sm">
            <span className="text-xs uppercase tracking-[0.14em] text-zinc-500">
              Fecha de nacimiento
            </span>
            <input
              type="date"
              data-testid="q-dob"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              required
              className="mt-1.5 block w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-sensu-400 focus:ring-2 focus:ring-sensu-200"
            />
          </label>

          <label className="text-sm">
            <span className="text-xs uppercase tracking-[0.14em] text-zinc-500">
              Género
            </span>
            <select
              data-testid="q-gender"
              value={gender}
              onChange={(e) => setGender(e.target.value as Gender)}
              className="mt-1.5 block w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-sensu-400 focus:ring-2 focus:ring-sensu-200"
            >
              {(Object.keys(GENDER_LABELS) as Gender[]).map((g) => (
                <option key={g} value={g}>
                  {GENDER_LABELS[g]}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm sm:col-span-2">
            <span className="text-xs uppercase tracking-[0.14em] text-zinc-500">
              CURP
            </span>
            <input
              type="text"
              data-testid="q-curp"
              value={curp}
              onChange={(e) => setCurp(e.target.value.toUpperCase())}
              placeholder="RIVR990317HDFVRN09"
              maxLength={18}
              required
              autoComplete="off"
              spellCheck={false}
              aria-invalid={curp.length > 0 && !curpValid ? true : undefined}
              className={`mt-1.5 block w-full rounded-xl border bg-white px-3 py-2 font-mono text-zinc-900 outline-none focus:ring-2 ${
                curp.length > 0 && !curpValid
                  ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-200'
                  : 'border-zinc-200 focus:border-sensu-400 focus:ring-sensu-200'
              }`}
            />
            <span className="mt-1 block text-[11px] leading-snug text-zinc-500">
              Estructura oficial: 4 letras + AAMMDD + H/M + 5 letras + letra + dígito (ej. RIVR990317HDFVRN09).
              Es la CURP del usuario de la Angela, no la tuya — la pedimos para poder
              brindar servicios de ambulancia, atención médica o asistencia vial si se necesita.
              {curp.length > 0 && curp.length < 18 ? (
                <span className="ml-1 text-rose-600">
                  Faltan {18 - curp.length} carácter{18 - curp.length === 1 ? '' : 'es'}.
                </span>
              ) : curp.length === 18 && !curpValid ? (
                <span className="ml-1 text-rose-600">
                  Formato inválido — revisa el orden de letras y dígitos.
                </span>
              ) : null}
            </span>
          </label>


          <label className="text-sm sm:col-span-2">
            <span className="text-xs uppercase tracking-[0.14em] text-zinc-500">
              Teléfono del usuario (opcional)
            </span>
            <input
              type="tel"
              data-testid="q-userPhone"
              value={userPhone}
              onChange={(e) => setUserPhone(e.target.value)}
              placeholder="55 1234 5678"
              maxLength={40}
              autoComplete="tel"
              className="mt-1.5 block w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-sensu-400 focus:ring-2 focus:ring-sensu-200"
            />
            <span className="mt-1 block text-[11px] leading-snug text-zinc-500">
              Si tu familiar usa un celular propio, lo guardamos para que el
              call-center pueda identificarlo cuando llame.
            </span>
          </label>
        </div>
      </section>

      {/* WHERE THEY LIVE --------------------------------------------- */}
      <section className="card-surface rounded-3xl p-6">
        <p className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
          <LuHouse aria-hidden className="h-4 w-4 text-emerald-500" />
          Dónde vive
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm sm:col-span-2">
            <span className="text-xs uppercase tracking-[0.14em] text-zinc-500">
              Dirección completa
            </span>
            <textarea
              data-testid="q-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={3}
              placeholder="Calle, número, depto, colonia, código postal, ciudad"
              maxLength={500}
              required
              className="mt-1.5 block w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-sensu-400 focus:ring-2 focus:ring-sensu-200"
            />
            <span className="mt-1 block text-[11px] leading-snug text-zinc-500">
              Aquí enviamos la Angela por mensajería, salvo que indiques otra dirección abajo.
            </span>
          </label>

          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                data-testid="q-altShipping-toggle"
                checked={useAltShipping}
                onChange={(e) => setUseAltShipping(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-sensu-500 focus:ring-2 focus:ring-sensu-200"
              />
              <span className="text-zinc-700">
                Enviar la Angela a otra dirección
              </span>
            </label>
            {useAltShipping ? (
              <label className="mt-3 block text-sm">
                <span className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                  Dirección de envío
                </span>
                <textarea
                  data-testid="q-shippingAddress"
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  rows={3}
                  placeholder="Calle, número, depto, colonia, código postal, ciudad"
                  maxLength={500}
                  required
                  className="mt-1.5 block w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-sensu-400 focus:ring-2 focus:ring-sensu-200"
                />
                <span className="mt-1 block text-[11px] leading-snug text-zinc-500">
                  Útil cuando tú pagas pero la Angela va al adulto mayor — o a un familiar que la entregue.
                </span>
              </label>
            ) : null}
          </div>

          <label className="text-sm">
            <span className="text-xs uppercase tracking-[0.14em] text-zinc-500">
              Vivienda
            </span>
            <select
              data-testid="q-housingType"
              value={housingType}
              onChange={(e) => setHousingType(e.target.value as HousingType)}
              className="mt-1.5 block w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-sensu-400 focus:ring-2 focus:ring-sensu-200"
            >
              {(Object.keys(HOUSING_LABELS) as HousingType[]).map((h) => (
                <option key={h} value={h}>
                  {HOUSING_LABELS[h]}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm flex items-center gap-2 mt-7">
            <input
              type="checkbox"
              data-testid="q-livesAlone"
              checked={livesAlone}
              onChange={(e) => setLivesAlone(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 text-sensu-500 focus:ring-2 focus:ring-sensu-200"
            />
            <span className="text-zinc-700">Vive sola/o</span>
          </label>
        </div>
      </section>

      {/* MEDICAL ----------------------------------------------------- */}
      <section className="card-surface rounded-3xl p-6">
        <p className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
          <LuStethoscope aria-hidden className="h-4 w-4 text-rose-500" />
          Información médica
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          El call-center sólo lo usa cuando tu familiar pide ayuda. Tu
          privacidad está protegida.
        </p>
        <div className="mt-5 space-y-4">
          <label className="text-sm block">
            <span className="text-xs uppercase tracking-[0.14em] text-zinc-500">
              Alergias, medicación actual y padecimientos
            </span>
            <textarea
              data-testid="q-medicalConditions"
              value={medicalConditions}
              onChange={(e) => setMedicalConditions(e.target.value)}
              rows={4}
              placeholder="Alergias: penicilina, AINEs.&#10;Medicación: Eutirox 75mg, Crestor 10mg L-M-V.&#10;Padecimientos: hipertensión, diabetes tipo 2."
              maxLength={2000}
              className="mt-1.5 block w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-sensu-400 focus:ring-2 focus:ring-sensu-200"
            />
          </label>

          <label className="text-sm block">
            <span className="text-xs uppercase tracking-[0.14em] text-zinc-500">
              Seguro médico (opcional)
            </span>
            <input
              type="text"
              data-testid="q-insuranceInfo"
              value={insuranceInfo}
              onChange={(e) => setInsuranceInfo(e.target.value)}
              placeholder="GNP — póliza 264349911"
              maxLength={500}
              className="mt-1.5 block w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-sensu-400 focus:ring-2 focus:ring-sensu-200"
            />
          </label>
        </div>
      </section>

      {/* WEEKLY CHECK-IN -------------------------------------------- */}
      <section className="card-surface rounded-3xl p-6">
        <p className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
          <LuPhone aria-hidden className="h-4 w-4 text-sky-500" />
          Check-in semanal (opcional)
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          El call-center llama una vez por semana a tu familiar para saber
          cómo está. Es un acompañamiento sencillo, especialmente útil para
          adultos mayores que viven solos.
        </p>

        <label className="mt-5 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            data-testid="q-checkInEnabled"
            checked={checkInEnabled}
            onChange={(e) => setCheckInEnabled(e.target.checked)}
            className="mt-0.5 h-4 w-4 cursor-pointer rounded border-zinc-300 text-sensu-500 focus:ring-sensu-300"
          />
          <span className="text-sm text-zinc-700">
            Sí, quiero el check-in semanal para mi familiar.
          </span>
        </label>

        {checkInEnabled && (
          <div
            data-testid="q-checkIn-schedule"
            className="mt-5 grid gap-4 sm:grid-cols-2"
          >
            <label className="text-sm">
              <span className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                Día de la llamada
              </span>
              <select
                data-testid="q-checkInDay"
                value={checkInDay}
                onChange={(e) => setCheckInDay(e.target.value as CheckInDay)}
                className="mt-1.5 block w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-sensu-400 focus:ring-2 focus:ring-sensu-200"
              >
                {(Object.keys(CHECK_IN_DAY_LABELS) as CheckInDay[]).map((d) => (
                  <option key={d} value={d}>
                    {CHECK_IN_DAY_LABELS[d]}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              <span className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                Hora preferida
              </span>
              <select
                data-testid="q-checkInTimeOfDay"
                value={checkInTimeOfDay}
                onChange={(e) =>
                  setCheckInTimeOfDay(e.target.value as CheckInTimeOfDay)
                }
                className="mt-1.5 block w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-sensu-400 focus:ring-2 focus:ring-sensu-200"
              >
                {(Object.keys(CHECK_IN_TIME_LABELS) as CheckInTimeOfDay[]).map(
                  (t) => (
                    <option key={t} value={t}>
                      {CHECK_IN_TIME_LABELS[t]}
                    </option>
                  ),
                )}
              </select>
            </label>

            {!seniorPhoneSatisfied && (
              <p
                data-testid="q-checkIn-phone-required"
                role="status"
                className="sm:col-span-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200"
              >
                El check-in necesita un teléfono. Captura el teléfono del
                usuario arriba para activar el servicio.
              </p>
            )}
          </div>
        )}
      </section>

      {/* EMERGENCY CONTACTS ----------------------------------------- */}
      <section className="card-surface rounded-3xl p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
              <LuHeartHandshake aria-hidden className="h-4 w-4 text-amber-500" />
              Contactos de emergencia
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              A quién llamamos primero. Mínimo uno; recomendamos dos.
            </p>
          </div>
          {contacts.length < 5 && (
            <button
              type="button"
              data-testid="q-add-contact"
              onClick={addContact}
              className="inline-flex items-center gap-1.5 rounded-full bg-sensu-500 px-3 py-1.5 text-xs font-medium tracking-tight text-white transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
            >
              <LuPlus aria-hidden className="h-3.5 w-3.5" />
              Agregar
            </button>
          )}
        </div>

        <div className="mt-5 space-y-4">
          {contacts.map((c, i) => (
            <div
              key={i}
              data-testid={`q-contact-${i}`}
              className="rounded-2xl border border-zinc-200 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                  Contacto {i + 1}
                </span>
                {contacts.length > 1 && (
                  <button
                    type="button"
                    data-testid={`q-contact-${i}-remove`}
                    onClick={() => removeContact(i)}
                    aria-label="Quitar contacto"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-rose-500 transition-colors hover:bg-rose-50 hover:text-rose-700"
                  >
                    <LuTrash2 aria-hidden className="h-4 w-4 text-rose-500" />
                  </button>
                )}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <label className="text-sm">
                  <span className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                    Nombre
                  </span>
                  <input
                    type="text"
                    data-testid={`q-contact-${i}-name`}
                    value={c.fullName}
                    onChange={(e) =>
                      updateContact(i, { fullName: e.target.value })
                    }
                    maxLength={120}
                    required
                    className="mt-1 block w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-sensu-400 focus:ring-2 focus:ring-sensu-200"
                  />
                </label>
                <label className="text-sm">
                  <span className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                    Parentesco
                  </span>
                  <input
                    type="text"
                    data-testid={`q-contact-${i}-relationship`}
                    value={c.relationship}
                    onChange={(e) =>
                      updateContact(i, { relationship: e.target.value })
                    }
                    placeholder="Hija, hijo, esposo…"
                    maxLength={60}
                    required
                    className="mt-1 block w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-sensu-400 focus:ring-2 focus:ring-sensu-200"
                  />
                </label>
                <label className="text-sm">
                  <span className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                    Teléfono
                  </span>
                  <input
                    type="tel"
                    data-testid={`q-contact-${i}-phone`}
                    value={c.phone}
                    onChange={(e) =>
                      updateContact(i, { phone: e.target.value })
                    }
                    placeholder="55 1234 5678"
                    maxLength={40}
                    required
                    className="mt-1 block w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-zinc-900 outline-none focus:border-sensu-400 focus:ring-2 focus:ring-sensu-200"
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      </section>

      {error && (
        <p
          data-testid="q-error"
          className="flex items-center gap-2 text-sm text-rose-700"
        >
          <LuCircleAlert aria-hidden className="h-4 w-4 shrink-0 text-rose-500" />
          {error}
        </p>
      )}

      <div className="sticky bottom-3 z-10 flex justify-end">
        <button
          type="submit"
          data-testid="q-submit"
          disabled={!canSubmit}
          className="inline-flex items-center gap-2 rounded-full bg-sensu-500 px-6 py-3 text-sm font-medium tracking-tight text-white shadow-[0_2px_4px_rgba(15,23,42,0.06),0_8px_24px_rgba(255,87,87,0.32)] transition-transform hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50 disabled:hover:translate-y-0"
        >
          {busy ? 'Activando…' : 'Activar mi Sensu'}
        </button>
      </div>
    </form>
  );
}
