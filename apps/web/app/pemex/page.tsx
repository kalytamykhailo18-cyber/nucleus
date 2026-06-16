import type { Metadata } from 'next';
import Link from 'next/link';
import {
  LuArrowRight,
  LuHeadphones,
  LuMapPin,
  LuSmartphone,
} from 'react-icons/lu';
import { prisma } from '@/lib/db';
import { fetchActivePlans, formatPriceMXN } from '@/lib/plans';
import { sensuContact } from '@/lib/contact-info';
import {
  SHIPPING_NET_CENTAVOS,
  grossCentsForNet,
} from '@/lib/plans';

const OG_IMAGE =
  'https://res.cloudinary.com/dcfjvxt5h/image/upload/c_fill,g_auto,w_1200,h_630,q_auto,f_jpg/v1780582692/sensu/landing/angela-device.png';

export const metadata: Metadata = {
  title: 'Sensu × Pemex — Beneficio para empleados',
  description:
    'Empleados de Pemex acceden a Sensu Angela con 10% de descuento en el plan anual. Monitoreo 24/7, botón SOS, GPS y respuesta humana.',
  alternates: { canonical: '/pemex' },
  openGraph: {
    title: 'Sensu × Pemex — Beneficio para empleados',
    description:
      'Empleados de Pemex acceden a Sensu Angela con 10% de descuento en el plan anual.',
    url: '/pemex',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Sensu × Pemex' }],
  },
  twitter: { card: 'summary_large_image', images: [OG_IMAGE] },
  robots: { index: false, follow: false }, // private partner page
};

export const dynamic = 'force-dynamic';

const PROMO_CODE = 'PEMEX10';

/**
 * Sensu × Pemex partner landing.
 *
 * Single-page, conversion-focused. Pemex employees arrive from their
 * employer's benefits channel (warm traffic), so we skip the long
 * education sweep that lives on / and surface only what affects the
 * decision: who-with-who, what Sensu does in one paragraph, the
 * already-discounted annual price next to the regular one, three
 * trust bullets, one CTA into /checkout with PEMEX10 + cadence=ANNUAL
 * pre-attached so nobody has to type anything.
 *
 * The same shell is the template for the next partner deal — fork
 * this file, rename the route, swap the logo line, swap the promo
 * code default, and ship.
 */
export default async function PemexPage(): Promise<React.ReactElement> {
  const [plans, promo] = await Promise.all([
    fetchActivePlans(),
    prisma.promoCode.findUnique({ where: { code: PROMO_CODE } }),
  ]);
  const plan = plans.find((p) => p.type === 'ANGELA_ESENCIAL') ?? plans[0];

  if (!plan || !promo) {
    return (
      <main
        data-testid="pemex-page"
        className="flex flex-1 items-center justify-center px-6 py-16"
      >
        <p className="text-sm text-zinc-600">
          Beneficio temporalmente no disponible. Vuelve pronto.
        </p>
      </main>
    );
  }

  // Same math as /api/checkout/start + PlanSummaryCadenceCard so the
  // partner page never disagrees with what the buyer sees on checkout.
  const recurringNet = plan.priceAnnualCents ?? 0;
  const initialFeeNet = plan.initialFeeCents ?? 0;
  const grossInitialFee = grossCentsForNet(initialFeeNet);
  const grossShipping = grossCentsForNet(SHIPPING_NET_CENTAVOS);
  const grossRecurring = grossCentsForNet(recurringNet);
  const regularTotal = grossInitialFee + grossShipping + grossRecurring;
  const discountedTotal = Math.round(
    regularTotal * (1 - promo.percentOffBps / 10_000),
  );
  const youSave = regularTotal - discountedTotal;

  const checkoutHref = `/checkout?plan=ANGELA_ESENCIAL&promo=${PROMO_CODE}&cadence=ANNUAL&source=pemex`;

  return (
    <main
      data-testid="pemex-page"
      className="flex flex-1 flex-col items-center px-6 pt-12 pb-16"
    >
      <div className="w-full max-w-2xl">
        {/* Partnership header */}
        <p
          data-testid="pemex-eyebrow"
          className="text-xs uppercase tracking-[0.18em] text-sensu-600 animate-fade-up"
        >
          Sensu × Pemex
        </p>
        <h1 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 animate-fade-up [animation-delay:80ms]">
          Beneficio exclusivo para empleados de Pemex.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-zinc-600 animate-fade-up [animation-delay:160ms]">
          Sensu Angela es un sistema de protección personal con botón SOS,
          GPS y un centro de asistencia con personas reales 24/7. Como
          beneficio Pemex, accedes al plan anual con{' '}
          <strong className="text-zinc-900">
            {promo.percentOffBps / 100}% de descuento
          </strong>
          .
        </p>

        {/* Price card */}
        <section
          data-testid="pemex-price-card"
          className="card-surface mt-8 rounded-3xl p-6 animate-rise [animation-delay:240ms]"
        >
          <p className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
            {plan.name} · Plan anual
          </p>
          <p className="mt-4 text-sm text-zinc-500 line-through tabular-nums">
            Precio regular {formatPriceMXN(regularTotal)}
          </p>
          <p
            data-testid="pemex-price-discounted"
            className="mt-1 text-4xl font-semibold tracking-tight text-zinc-900 tabular-nums"
          >
            {formatPriceMXN(discountedTotal)}
            <span className="ml-2 align-middle text-sm font-medium text-zinc-500">
              / año
            </span>
          </p>
          <p
            data-testid="pemex-price-savings"
            className="mt-2 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-100"
          >
            Ahorras {formatPriceMXN(youSave)} con tu beneficio Pemex
          </p>

          <ul className="mt-6 space-y-3 text-sm text-zinc-700">
            <li className="flex items-start gap-3">
              <span
                aria-hidden
                className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sensu-50 text-sensu-600"
              >
                <LuHeadphones className="h-3.5 w-3.5" />
              </span>
              <span>
                <span className="font-medium text-zinc-900">
                  Call-center 24/7 con respuesta humana
                </span>
                {' '}— un operador real recibe cada alerta, llama a tu
                familiar y coordina ambulancia si se necesita.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span
                aria-hidden
                className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sensu-50 text-sensu-600"
              >
                <LuSmartphone className="h-3.5 w-3.5" />
              </span>
              <span>
                <span className="font-medium text-zinc-900">App familiar</span>
                {' '}— ubicación en tiempo real, alertas en el celular y panel
                para todos los familiares.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span
                aria-hidden
                className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sensu-50 text-sensu-600"
              >
                <LuMapPin className="h-3.5 w-3.5" />
              </span>
              <span>
                <span className="font-medium text-zinc-900">
                  GPS + dispositivo Angela
                </span>
                {' '}— botón SOS portátil con conexión celular propia y
                detección automática de caídas. Sin necesidad de un celular
                cerca.
              </span>
            </li>
          </ul>

          <Link
            href={checkoutHref}
            data-testid="pemex-cta"
            className="mt-8 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-sensu-500 px-7 text-sm font-medium tracking-tight text-white shadow-[0_10px_30px_rgba(244,63,94,0.35)] transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
          >
            Activar mi beneficio Pemex
            <LuArrowRight aria-hidden className="h-4 w-4" />
          </Link>
          <p className="mt-3 text-xs leading-snug text-zinc-500">
            Tu descuento se aplica automáticamente al continuar. El plan se
            cobra una vez por el año completo.
          </p>
        </section>

        {/* Trust footer */}
        <p
          data-testid="pemex-footer"
          className="mt-8 text-xs leading-snug text-zinc-500"
        >
          Beneficio válido solo para empleados activos y pensionados de
          Pemex. Sensu es operado por un equipo mexicano con centro de
          atención 24/7 en español; cualquier duda, llámanos sin costo al{' '}
          <a
            href={`tel:${sensuContact.callcenter().tel}`}
            className="font-medium text-sensu-600 hover:text-sensu-500"
          >
            {sensuContact.callcenter().display}
          </a>
          .
        </p>
      </div>
    </main>
  );
}
