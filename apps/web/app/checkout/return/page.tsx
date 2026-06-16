/**
 * Stripe `return_url` landing page for 3DS / SCA flows.
 *
 * Test card 4242 4242 4242 4242 never redirects here — `redirect:
 * 'if_required'` keeps the happy path in-page. This route exists so
 * that real cards (3DS challenge, SCA, etc.) have somewhere to land
 * after the bank's auth dialog. The query carries the PaymentIntent
 * status; on success we just bounce to /dashboard via the auto-login
 * logic on the inline form. For Phase A we keep it minimal.
 */
import { Suspense } from 'react';
import Link from 'next/link';

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
          <p className="mt-6 text-sm">
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
