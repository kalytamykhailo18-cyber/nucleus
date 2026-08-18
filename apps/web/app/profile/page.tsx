import { Suspense } from 'react';
import Link from 'next/link';
import { LuArrowRight, LuGift } from 'react-icons/lu';
import { requireFamilySession } from '@/lib/admin';
import { isMasterUser } from '@/lib/family-share';
import { FamilyShareCard } from '@/components/family-share-card';
import ProfileForm from './profile-form';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const { id: userId } = await requireFamilySession('/profile');
  // Only the Master User on this account sees the share-with-family
  // card. Watchers consumed an invite; they don't get to mint more.
  const showFamilyShare = await isMasterUser(userId);

  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-start justify-center px-6 pt-20 pb-12">
          <div className="w-full max-w-2xl">
            <h1 className="text-3xl font-semibold tracking-tight">Perfil</h1>
            <p className="mt-3 text-sm text-zinc-500">Cargando…</p>
          </div>
        </main>
      }
    >
      <ProfileForm />
      {showFamilyShare ? (
        <main className="flex justify-center px-6 pb-12">
          <div className="w-full max-w-2xl">
            <FamilyShareCard />
          </div>
        </main>
      ) : null}
      {userId ? (
        <main className="flex justify-center px-6 pb-12">
          <div className="w-full max-w-2xl">
            <Link
              href="/profile/referrals"
              data-testid="profile-referrals-cta"
              className="card-surface flex items-center justify-between gap-4 rounded-3xl p-6 ring-1 ring-inset ring-sensu-200/70 transition-colors hover:bg-sensu-50/30"
            >
              <span className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sensu-50 ring-1 ring-sensu-200">
                  <LuGift aria-hidden className="h-5 w-5 text-sensu-500" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-zinc-900">
                    Invita a un familiar y gana $500 de crédito
                  </span>
                  <span className="mt-0.5 block text-xs text-zinc-500">
                    Comparte tu código de referido y aplicamos el crédito en
                    tu siguiente renovación.
                  </span>
                </span>
              </span>
              <LuArrowRight aria-hidden className="h-4 w-4 text-sensu-500" />
            </Link>
          </div>
        </main>
      ) : null}
    </Suspense>
  );
}
