import { notFound } from 'next/navigation';
import { LuLink, LuPhone, LuSparkles } from 'react-icons/lu';
import { requireSalesOrAdmin } from '@/lib/admin';
import { SectionLabel } from '@/components/section-label';
import { env } from '@/lib/env';
import { AssistedSalesForm } from './assisted-sales-form';
import { CrearDemoButton } from '../registrations/crear-demo-button';

/**
 * /admin/assisted-sales — Juan 2026-06-22. One-click Stripe Payment
 * Link generator for the WhatsApp sales rail. The rep types name,
 * phone, email, and plan, and the page hands back a payment link
 * ready to paste into the WhatsApp conversation.
 *
 * Gated by NUCLEUS_ASSISTED_SALES_ENABLED so it stays invisible to
 * admins until the feature is greenlit; the create-link route mirrors
 * the same gate so a direct POST also 404s.
 */
export const dynamic = 'force-dynamic';

export default async function AssistedSalesPage(): Promise<React.ReactElement> {
  if (!env.NUCLEUS_ASSISTED_SALES_ENABLED) notFound();
  await requireSalesOrAdmin();

  return (
    <main
      data-testid="admin-assisted-sales-page"
      className="flex flex-1 flex-col items-center px-6 pt-12 pb-12"
    >
      <div className="w-full max-w-3xl">
        <SectionLabel icon={LuPhone} tone="sensu">
          Venta asistida por WhatsApp
        </SectionLabel>
        <h1 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900">
          Generar enlace de pago
        </h1>
        <p className="mt-3 text-base text-zinc-500">
          Llena los datos del cliente y obtén un enlace de pago listo para
          enviar por WhatsApp. Al pagar, recibe un mensaje para configurar su
          contraseña y completar el cuestionario.
        </p>

        <AssistedSalesForm />

        {/*
          Self-serve demo creation (Juan 2026-06-30). Same flow the
          ADMIN row uses on /admin/registrations, exposed here so the
          sales team can open a free trial account without going
          through Juan. requireSalesOrAdmin is what gates the route
          on the API side too.
        */}
        <section
          data-testid="admin-assisted-sales-demo"
          className="card-surface mt-10 rounded-3xl p-6"
        >
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
            <LuSparkles aria-hidden className="h-4 w-4 text-sensu-500" />
            Demostración sin cobro
          </div>
          <p className="mt-3 text-sm text-zinc-700">
            ¿El prospecto pide ver el panel antes de pagar? Crea una
            cuenta demo gratuita: le mandamos el correo de bienvenida
            con el enlace para que entre y complete el cuestionario,
            igual que un cliente pagado.
          </p>
          <div className="mt-4">
            <CrearDemoButton />
          </div>
        </section>

        <div className="card-surface mt-10 rounded-3xl p-6">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
            <LuLink aria-hidden className="h-4 w-4" />
            Cómo funciona
          </div>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-zinc-700">
            <li>El representante de ventas llena el formulario con el nombre, teléfono, correo y plan del cliente.</li>
            <li>Al hacer clic en <strong>Generar enlace</strong>, el sistema crea un Payment Link de Stripe y lo muestra arriba.</li>
            <li>El representante copia el enlace y lo manda por WhatsApp al cliente.</li>
            <li>El cliente paga desde su teléfono. Stripe procesa el cobro y, en automático, el sistema crea su cuenta en Sensu.</li>
            <li>El cliente recibe un correo con un botón para configurar su contraseña y completar el cuestionario del usuario de la Angela.</li>
          </ol>
        </div>
      </div>
    </main>
  );
}
