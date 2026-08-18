import type { Metadata } from 'next';
import { LuLifeBuoy } from 'react-icons/lu';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { SectionLabel } from '@/components/section-label';
import { fetchAllArticles, fetchPublishedArticles } from '@/lib/support';
import { sensuContact } from '@/lib/contact-info';
import { SoporteClient } from './soporte-client';

export const dynamic = 'force-dynamic';

const OG_IMAGE =
  'https://sensu.com.mx/opengraph-image';

export const metadata: Metadata = {
  title: 'Ayuda — Sensu',
  description:
    'Manuales, videos y guías para sacar el máximo provecho de tu Angela.',
  alternates: { canonical: '/soporte' },
  openGraph: {
    title: 'Ayuda — Sensu',
    description:
      'Manuales, videos y guías para sacar el máximo provecho de tu Angela.',
    url: '/soporte',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Sensu Angela — Ayuda' }],
  },
  twitter: { card: 'summary_large_image', images: [OG_IMAGE] },
};

export default async function SoportePage(): Promise<React.ReactElement> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  let isAdmin = false;
  if (userId) {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    isAdmin = u?.role === 'ADMIN';
  }

  // Admins see drafts too so they can edit unpublished guides in place.
  const articles = isAdmin
    ? await fetchAllArticles()
    : await fetchPublishedArticles();

  return (
    <main
      data-testid="soporte-page"
      className="flex flex-1 flex-col items-center px-6 pt-12 pb-12"
    >
      <div className="w-full max-w-3xl">
        <SectionLabel icon={LuLifeBuoy} tone="sensu">
          Ayuda y manuales
        </SectionLabel>
        <h1 className="mt-2 text-4xl sm:text-5xl font-semibold tracking-tight text-zinc-900">
          ¿En qué te ayudamos?
        </h1>
        <p className="mt-3 text-base text-zinc-500">
          Manuales rápidos, videos y guías para usar tu Angela con
          confianza. El call center también está activo 24/7 al{' '}
          <a
            href={`tel:${sensuContact.callcenter().tel}`}
            className="font-medium text-sensu-600 underline underline-offset-2 hover:text-sensu-700"
          >
            {sensuContact.callcenter().display}
          </a>
          .
        </p>

        <SoporteClient initialArticles={articles} isAdmin={isAdmin} />
      </div>
    </main>
  );
}
