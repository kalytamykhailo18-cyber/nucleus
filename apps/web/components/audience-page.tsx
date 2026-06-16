import Link from 'next/link';
import { LuArrowRight, LuCheck } from 'react-icons/lu';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { fetchLandingOverrides, pickText, pickVideo } from '@/lib/landing';
import { CardEditPencil } from './card-edit-pencil';

/**
 * Shared shell for audience-specific landing pages
 * (/adultos-mayores, /ninos, /mujeres, /trabajadores, /para-mi,
 * /especializado). Lovable on sensu.com.mx ships one of these per
 * audience segment; Nucleus mirrors them so the DNS cutover preserves
 * every persona page.
 *
 * Layout (per Ustym 2026-06-04): the hero section is a clean full-bleed
 * video — no scrim, no text overlay, no blur. The entire textual
 * content (eyebrow → title → lead → feature bullets → closing → CTAs)
 * lives in a dedicated section BELOW the video so the video reads as
 * unfiltered marketing reel and the copy gets the space it deserves.
 *
 * Inline-CMS pencil floats in the hero corner and edits every field
 * (eyebrow, title, lead, features list, closing, video URL) in one
 * modal. Default video URLs are passed by each route file pointing at
 * the Cloudinary mirror of the Lovable hero loop.
 */
export async function AudiencePage({
  slug,
  defaults,
}: {
  slug: string;
  defaults: {
    eyebrow: string;
    title: string;
    lead: string;
    features: string[];
    closing: string;
    /** Cloudinary mp4 URL for the hero background. */
    videoUrl: string;
    /** Optional cloudinary first-frame jpg used as `poster` for instant paint. */
    posterUrl?: string;
  };
}): Promise<React.ReactElement> {
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
  const overrides = await fetchLandingOverrides();
  const t = (sub: string, fallback: string): string =>
    pickText(overrides, `${slug}-${sub}`, fallback);

  const eyebrow = t('eyebrow', defaults.eyebrow);
  const title = t('title', defaults.title);
  const lead = t('lead', defaults.lead);
  const featuresText = t('features', defaults.features.join('\n'));
  const features = featuresText
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const closing = t('closing', defaults.closing);
  const videoUrl = pickVideo(overrides, `${slug}-video`, {
    url: defaults.videoUrl,
  }).url;
  // Derive a Cloudinary first-frame poster from the video URL (so the
  // hero is never blank when autoplay is denied / metadata still
  // loading).
  const posterUrl =
    defaults.posterUrl ??
    videoUrl
      .replace(/\/video\/upload\/(v\d+\/)?/, '/video/upload/so_0,f_jpg,q_auto/$1')
      .replace(/\.[a-z0-9]+$/i, '.jpg');

  return (
    <main
      data-testid={`audience-${slug}`}
      className="flex flex-1 flex-col"
    >
      {/* HERO — clean full-bleed video. No scrim, no overlay text, no
          blur. The video plays at its natural look so it carries the
          marketing impact alone. */}
      <section
        data-testid={`audience-${slug}-hero`}
        className="relative w-screen overflow-hidden bg-black"
      >
        <video
          src={videoUrl}
          poster={posterUrl}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden
          className="block h-screen w-full object-cover"
        />
        {isAdmin && (
          <CardEditPencil
            slugBase={slug}
            modalTitle={`Editar página /${slug}`}
            fields={[
              { key: 'eyebrow', label: 'Eyebrow', type: 'text', initial: eyebrow },
              { key: 'title', label: 'Título', type: 'multiline', initial: title },
              { key: 'lead', label: 'Párrafo inicial', type: 'multiline', initial: lead },
              {
                key: 'features',
                label: 'Puntos (un punto por línea)',
                type: 'multiline',
                initial: featuresText,
              },
              { key: 'closing', label: 'Texto de cierre', type: 'multiline', initial: closing },
              {
                key: 'video',
                label: 'URL del video de fondo',
                type: 'video',
                initial: videoUrl,
                slug: `${slug}-video`,
              },
            ]}
            className="absolute right-6 top-6 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-sensu-600 shadow-sm ring-1 ring-inset ring-white/40 backdrop-blur hover:opacity-100 cursor-pointer"
          />
        )}
      </section>

      {/* BODY — eyebrow + title + lead + features + closing + CTAs */}
      <section className="w-full px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-2xl">
          <p className="text-xs uppercase tracking-[0.18em] text-sensu-600 animate-fade-up">
            {eyebrow}
          </p>
          <h1 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-zinc-900 animate-fade-up [animation-delay:80ms] whitespace-pre-wrap">
            {title}
          </h1>
          <p className="mt-6 text-base sm:text-lg leading-relaxed text-zinc-600 animate-fade-up [animation-delay:160ms] whitespace-pre-wrap">
            {lead}
          </p>

          {features.length > 0 && (
            <ul className="mt-10 space-y-3 animate-fade-up [animation-delay:240ms]">
              {features.map((f, i) => (
                <li
                  key={i}
                  data-testid={`audience-${slug}-feature-${i + 1}`}
                  className="flex items-start gap-3 text-base text-zinc-700"
                >
                  <LuCheck aria-hidden className="mt-1 h-4 w-4 shrink-0 text-emerald-500" />
                  <span className="whitespace-pre-wrap">{f}</span>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-10 text-base sm:text-lg leading-relaxed text-zinc-700 italic animate-fade-up [animation-delay:300ms] whitespace-pre-wrap">
            {closing}
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3 animate-fade-up [animation-delay:360ms]">
            <Link
              href={`/checkout?source=${slug}`}
              data-testid={`audience-${slug}-cta`}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-sensu-500 px-7 text-sm font-medium tracking-tight text-white transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
            >
              Empezar con Ángela
              <LuArrowRight aria-hidden className="h-4 w-4" />
            </Link>
            <Link
              href="/"
              className="inline-flex h-12 items-center rounded-full bg-white px-6 text-sm font-medium tracking-tight text-zinc-700 ring-1 ring-zinc-200 transition-colors hover:bg-zinc-50"
            >
              Volver al inicio
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
