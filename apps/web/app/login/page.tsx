import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { resolveLandingPath } from '@/lib/post-login-destination';
import LoginForm from './login-form';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  // Authed users skip the form and land on their canonical surface —
  // admins on `/` (CMS), company-admins on `/company`, family on
  // `/dashboard`. Beats re-showing the form to someone already in.
  // Middleware (apps/web/middleware.ts) handles the global ADMIN case
  // by routing to `/` before the request reaches here; this guard
  // catches anyone whose role isn't visible to the Edge-runtime JWT
  // check (e.g. the company-admin case that needs Prisma).
  const session = await auth();
  if (session?.user) {
    const role = (session.user as { role?: 'USER' | 'ADMIN' }).role ?? null;
    const userId = (session.user as { id?: string }).id ?? null;
    const landing = await resolveLandingPath({ userId, role });
    redirect(landing);
  }

  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center px-6 py-24">
          <div className="card-surface w-full max-w-md rounded-3xl p-8">
            <h1 className="text-2xl font-semibold tracking-tight">Iniciar sesión</h1>
            <p className="mt-3 text-sm text-zinc-500">Cargando…</p>
          </div>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
