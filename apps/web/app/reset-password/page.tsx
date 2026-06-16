import { Suspense } from 'react';
import ResetForm from './reset-form';

export const dynamic = 'force-dynamic';

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center px-6 py-24">
          <div className="card-surface w-full max-w-md rounded-3xl p-8">
            <h1 className="text-2xl font-semibold tracking-tight">
              Nueva contraseña
            </h1>
            <p className="mt-3 text-sm text-zinc-500">Cargando…</p>
          </div>
        </main>
      }
    >
      <ResetForm />
    </Suspense>
  );
}
