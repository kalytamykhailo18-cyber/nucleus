/**
 * Stripe `return_url` landing page for 3DS / SCA flows.
 *
 * Test card 4242 4242 4242 4242 never redirects here — `redirect:
 * 'if_required'` keeps the happy path in-page. This route exists so
 * that real cards (3DS challenge, SCA, etc.) have somewhere to land
 * after the bank's auth dialog. The query carries the PaymentIntent
 * status; on success we just bounce to /dashboard via the auto-login
 * logic on the inline form.
 *
 * Ustym 2026-08-10 addition: the page now proactively surfaces the
 * "instala la app en tu teléfono" step as a big clickable button.
 * Prior version only offered a "Inicia sesión" link, so freshly-paid
 * buyers never saw the install path until they happened to notice
 * the one-shot bottom-sheet on /login. Real users click, they never
 * type URLs — the button here is the click-path into /instalar.
 */
import { Suspense } from 'react';
import Link from 'next/link';
import { LuArrowRight, LuSmartphone } from 'react-icons/lu';

export default function CheckoutReturnPage() {
  return (
    <main
      data-testid="checkout-return-page"
      className="flex flex-1 items-center justify-center px-6 py-16"
    >
      <Suspense fallback={null}>
        <div className="w-full max-w-md text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Procesando tu pago…
          </h1>
          <p className="mt-3 text-sm text-zinc-600">
            Cuando el banco confirme la transacción, tu cuenta queda activa.
          </p>

          <div className="mt-8 rounded-3xl bg-white px-5 py-5 text-left ring-1 ring-zinc-200 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-sensu-700">
              <LuSmartphone aria-hidden className="h-4 w-4" />
              Siguiente paso
            </div>
            <p className="mt-2 text-base font-medium text-zinc-900">
              Instala Sensu en el teléfono
            </p>
            <p className="mt-1 text-sm text-zinc-600">
              Así recibes las alertas con sonido cuando tu familiar dispara un SOS o el pendant se queda sin batería.
            </p>
            <Link
              href="/instalar"
              data-testid="checkout-return-install"
              className="mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-sensu-500 px-5 text-sm font-medium tracking-tight text-white transition-transform hover:-translate-y-0.5 active:scale-[0.98] cursor-pointer"
            >
              Cómo instalar la app
              <LuArrowRight aria-hidden className="h-4 w-4" />
            </Link>
          </div>

          <p className="mt-8 text-sm">
            <Link className="text-sensu-600 hover:text-sensu-700" href="/login">
              Inicia sesión
            </Link>{' '}
            para ver tu panel.
          </p>
        </div>
      </Suspense>
    </main>
  );
}
