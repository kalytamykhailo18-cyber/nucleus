import { Suspense } from 'react';
import { auth } from '@/auth';
import { isMasterUser } from '@/lib/family-share';
import { FamilyShareCard } from '@/components/family-share-card';
import ProfileForm from './profile-form';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id ?? null;
  // Only the Master User on this account sees the share-with-family
  // card. Watchers consumed an invite; they don't get to mint more.
  const showFamilyShare = userId ? await isMasterUser(userId) : false;

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
    </Suspense>
  );
}
