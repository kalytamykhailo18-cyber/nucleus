import type { Metadata } from 'next';
import Link from 'next/link';
import { LuArrowRight, LuCheck, LuPhone, LuShieldCheck } from 'react-icons/lu';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { fetchActivePlans, formatPriceMXN } from '@/lib/plans';
import { fetchLandingOverrides, pickText } from '@/lib/landing';
import { CardEditPencil } from '@/components/card-edit-pencil';
import { sensuContact } from '@/lib/contact-info';

const OG_IMAGE =
  'https://res.cloudinary.com/dcfjvxt5h/image/upload/c_fill,g_auto,w_1200,h_630,q_auto,f_jpg/v1780521540/sensu/landing/angela-esencial-hero.png';

export const metadata: Metadata = {
  title: 'Sensu Angela — Planes',
  description:
    'Protección inteligente al mejor precio. Conoce el Plan Esencial: dispositivo Angela, monitoreo 24/7 del call center, alertas en la app familiar y soporte humano cuando lo necesites.',
  alternates: { canonical: '/planes' },
  openGraph: {
    title: 'Sensu Angela — Planes',
    description:
      'Plan Esencial $550 MXN/mes — dispositivo Angela, monitoreo 24/7, app familiar y respuesta humana en cualquier emergencia.',
    url: '/planes',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Sensu Angela — Plan Esencial' }],
  },
  twitter: { card: 'summary_large_image', images: [OG_IMAGE] },
};

export const dynamic = 'force-dynamic';

/**
 * Plan-detail page. Renders the exact same plan-card markup as the
 * landing-page section, so the two surfaces stay visually identical
 * (Juan 2026-06-05: "the only thing missing is this same box to
 * appear in the /planes page"). No image banner — landing's card is
 * text-only.
 */
export default async function PlanesPage(): Promise<React.ReactElement> {
  const session = await auth();
  let isAdmin = false;
  const userId = session?.user
    ? (session.user as { id?: string }).id ?? null
    : null;
  if (userId) {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    isAdmin = u?.role === 'ADMIN';
  }
  const [plans, overrides] = await Promise.all([
    fetchActivePlans(),
    fetchLandingOverrides(),
  ]);
  const t = (sub: string, fallback: string): string =>
    pickText(overrides, `planes-${sub}`, fallback);

  const heroEyebrow = t('hero-eyebrow', 'Planes');
  const heroTitle = t('hero-title', 'Elige la protección que necesitas.');
  const heroLead = t(
    'hero-lead',
    'Cancela cuando quieras. Sin contratos largos, sin sorpresas.',
  );

  return (
    <main data-testid="planes-page" className="flex flex-1 flex-col">
      {/* HERO COPY — title + lead exactly mirror the landing-page plan
          section (`Elige la protección que necesitas.`). */}
      <section className="relative w-full px-6 pt-20 pb-8 sm:pt-24">
        {isAdmin && (
          <CardEditPencil
            slugBase="planes-hero"
            modalTitle="Editar encabezado de Planes"
            fields={[
              { key: 'eyebrow', label: 'Eyebrow', type: 'text', initial: heroEyebrow, slug: 'planes-hero-eyebrow' },
              { key: 'title', label: 'Título', type: 'multiline', initial: heroTitle, slug: 'planes-hero-title' },
              { key: 'lead', label: 'Párrafo inicial', type: 'multiline', initial: heroLead, slug: 'planes-hero-lead' },
            ]}
            className="absolute right-6 top-6 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-sensu-600 shadow-sm ring-1 ring-inset ring-zinc-200 hover:opacity-100 cursor-pointer"
          />
        )}
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs uppercase tracking-[0.18em] text-sensu-600 animate-fade-up">
            {heroEyebrow}
          </p>
          <h1 className="mt-3 text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-zinc-900 animate-fade-up [animation-delay:80ms] whitespace-pre-wrap">
            {heroTitle}
          </h1>
          <p className="mt-6 text-base sm:text-lg leading-relaxed text-zinc-600 animate-fade-up [animation-delay:160ms] whitespace-pre-wrap">
            {heroLead}
          </p>
        </div>
      </section>

      {/* PLAN CARD(S) — byte-for-byte the same markup as the landing-page
          PLAN PICKER section, minus the section heading (already in the
          hero copy above). */}
      <section
        data-testid="planes-cards"
        id="planes"
        className="w-full px-6 py-12"
      >
        <div
          data-testid="plan-picker"
          className={
            plans.length === 1
              ? 'mx-auto max-w-md'
              : 'mx-auto grid max-w-5xl gap-5 sm:grid-cols-2'
          }
        >
          {plans.map((plan, i) => (
            <article
              key={plan.id}
              data-testid={`plan-${plan.type}`}
              className="card-surface card-surface-hoverable rounded-3xl p-7 hover:-translate-y-1 animate-rise"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
                  <LuShieldCheck
                    aria-hidden
                    className={`h-4 w-4 ${plan.includesAura ? 'text-violet-500' : 'text-emerald-500'}`}
                  />
                  <span data-testid={`plan-${plan.type}-name`}>{plan.name}</span>
                </p>
                {plan.isPopular && (
                  <span className="rounded-full bg-sensu-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sensu-700">
                    Más popular
                  </span>
                )}
              </div>
              <p
                data-testid={`plan-${plan.type}-price`}
                className="mt-5 text-3xl font-semibold tracking-tight text-zinc-900 tabular-nums"
              >
                {formatPriceMXN(
                  plan.priceMonthlyCents ?? plan.monthlyPriceCents,
                )}
                <span className="ml-2 align-middle text-xs font-medium tracking-normal text-zinc-500">
                  + IVA
                </span>
              </p>
              <p className="mt-3 text-sm leading-relaxed text-zinc-600">
                {plan.description}
              </p>
              <ul className="mt-5 space-y-3 text-sm text-zinc-700">
                <li className="flex items-start gap-2">
                  <LuCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <span><span className="font-medium">Dispositivo Angela incluido</span> — GPS en tiempo real, botón SOS y llamadas bidireccionales.</span>
                </li>
                <li className="flex items-start gap-2">
                  <LuCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <span><span className="font-medium">Monitoreo 24/7 con respuesta humana</span> — un operador real recibe cada alerta. No un bot.</span>
                </li>
                <li className="flex items-start gap-2">
                  <LuCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <span><span className="font-medium">App familiar</span> — ubicación en tiempo real y notificaciones cuando algo pasa.</span>
                </li>
                <li className="flex items-start gap-2">
                  <LuCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <span><span className="font-medium">Geo-cercas inteligentes</span> — alerta cuando tu familiar entra o sale de zonas seguras que tú defines.</span>
                </li>
                <li className="flex items-start gap-2">
                  <LuCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <span><span className="font-medium">Detección automática de caídas</span> — el dispositivo reconoce caídas y lanza alerta sin intervención.</span>
                </li>
                <li className="flex items-start gap-2">
                  <LuCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <span><span className="font-medium">Coordinación de emergencias</span> — ambulancia y apoyo inmediato cuando se necesita.</span>
                </li>
                {plan.includesAura && (
                  <>
                    <li className="pt-3 mt-2 border-t border-zinc-100 text-xs uppercase tracking-[0.14em] text-violet-600">
                      Beneficios exclusivos del Plan Total
                    </li>
                    <li className="flex items-start gap-2">
                      <LuCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
                      <span><span className="font-medium">Asistencia médica telefónica</span> — un médico al teléfono ante cualquier duda o síntoma.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <LuCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
                      <span><span className="font-medium">Médico a domicilio</span> — atención presencial sin salir de casa.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <LuCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
                      <span><span className="font-medium">Apoyo psicológico, nutricional y embarazo</span> — orientación especializada.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <LuCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
                      <span><span className="font-medium">Auxilio vial</span> — grúa, cambio de llanta, paso de corriente, gasolina.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <LuCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
                      <span><span className="font-medium">Asistencia para el hogar</span> — cerrajero, plomero, electricista cuando lo necesites.</span>
                    </li>
                  </>
                )}
              </ul>
              <Link
                href={`/checkout?plan=${plan.type}`}
                data-testid={`plan-${plan.type}-cta`}
                className={`mt-7 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-medium tracking-tight transition-transform hover:-translate-y-0.5 active:scale-[0.98] ${
                  plan.includesAura
                    ? 'bg-zinc-900 text-white hover:bg-zinc-800'
                    : 'bg-sensu-500 text-white hover:bg-sensu-600'
                }`}
              >
                Elegir {plan.type === 'ANGELA_TOTAL' ? 'Total' : 'Esencial'}
                <LuArrowRight aria-hidden className="h-4 w-4" />
              </Link>
            </article>
          ))}
        </div>
      </section>

      {/* HELP / CONTACT SECTION */}
      <section className="w-full px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
            Garantía
          </p>
          <h2 className="mt-3 text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900">
            Ofrecemos un mes de garantía
          </h2>
          <p className="mt-3 text-base text-zinc-600">
            Protección que se siente. Diseñado para acompañarte en cada momento, sin estorbar.
          </p>
          <h3 className="mt-10 text-xl font-semibold tracking-tight text-zinc-900">
            ¿Necesitas ayuda para elegir?
          </h3>
          <p className="mt-2 text-sm text-zinc-600">
            Contáctanos y te ayudaremos a encontrar el plan perfecto para ti y tu familia.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <a
              href={`tel:${sensuContact.callcenter().tel}`}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-sensu-500 px-5 text-sm font-medium tracking-tight text-white transition-transform hover:-translate-y-0.5"
            >
              <LuPhone aria-hidden className="h-4 w-4" />
              Llamar sin costo · {sensuContact.callcenter().display}
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
