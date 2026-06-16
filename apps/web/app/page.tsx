import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  LuActivity,
  LuArrowRight,
  LuBatteryFull,
  LuBellRing,
  LuCalendar,
  LuCheck,
  LuClock,
  LuHeadphones,
  LuHeart,
  LuMapPin,
  LuMapPinned,
  LuPhoneCall,
  LuRadio,
  LuShield,
  LuShieldCheck,
  LuSmartphone,
  LuStar,
  LuStethoscope,
  LuSunMedium,
  LuSunset,
  LuUsers,
  LuWaves,
} from 'react-icons/lu';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { FaqAccordion } from '@/components/faq-accordion';
import { LandingVideo } from '@/components/landing-video';
import { MediaLightbox } from '@/components/media-lightbox';
import { TestimonialCarousel } from '@/components/testimonial-carousel';
import { CardEditPencil } from '@/components/card-edit-pencil';
import { HeroPhone } from '@/components/hero-phone';
import { fetchActivePlans, formatPriceMXN } from '@/lib/plans';
import { fetchLandingOverrides, pickImage, pickText, pickVideo } from '@/lib/landing';

/**
 * Marketing landing page (Step 12).
 *
 * Sections, top to bottom:
 *   - hero        — title, subtitle, primary CTA into plan picker
 *   - how-it-works — three numbered steps (botón, familiar, panel)
 *   - plan picker — Esencial vs Total, both linking to /checkout
 *   - FAQ         — native <details> accordion, no JS dep
 *   - footer CTA  — final big "empieza hoy" pill
 *
 * Authed users redirect to /dashboard from this route — they shouldn't
 * land on the marketing page once they've signed in.
 */
export default async function HomePage() {
  const session = await auth();
  // Admins stay on `/` so they can drive the inline landing CMS (per
  // Ustym 2026-05-28 — pencil overlays appear in place, no separate
  // /admin/landing route). Non-admin authed users still bounce to
  // their dashboard since they have no reason to be on the marketing
  // page once they have an account.
  let isAdmin = false;
  if (session?.user) {
    // Trust the role baked into the JWT at login time — it survives DB
    // re-seeds that change the User.id under us. Fall back to a fresh
    // DB lookup only when the JWT didn't carry role (very old sessions
    // pre the auth.config session-callback change).
    const role = (session.user as { role?: 'USER' | 'ADMIN' }).role;
    if (role === 'ADMIN') {
      isAdmin = true;
    } else if (!role) {
      const userId = (session.user as { id?: string }).id;
      const email = (session.user as { email?: string }).email;
      if (userId || email) {
        const u = await prisma.user.findFirst({
          where: userId ? { id: userId } : { email: email! },
          select: { role: true },
        });
        isAdmin = u?.role === 'ADMIN';
      }
    }
    if (!isAdmin) {
      redirect('/dashboard');
    }
  }

  const [plans, landingOverrides] = await Promise.all([
    fetchActivePlans(),
    fetchLandingOverrides(),
  ]);

  // Every "structural" copy slot on / is sourced from a LandingItem
  // override when one exists, otherwise falls back to the original
  // JSX default below. Per Ustym 2026-05-28 — the inline EditableText
  // overlays a pencil for ADMIN sessions; visitors see the same
  // markup they always did.
  const t = (slug: string, fallback: string): string =>
    pickText(landingOverrides, slug, fallback);
  const img = (
    slug: string,
    fallback: { url: string; alt?: string },
  ): { url: string; alt: string } => pickImage(landingOverrides, slug, fallback);
  const vid = (slug: string, fallback: { url: string }): { url: string } =>
    pickVideo(landingOverrides, slug, fallback);
  const txt = {
    heroTitle: t('hero-title', 'Siempre hay alguien listo para ayudarte.'),
    heroSubtitle: t(
      'hero-subtitle',
      'Sensu Angela te conecta con un equipo humano real en cualquier emergencia. Un botón GPS para tu familiar mayor, un call center 24/7 con respuesta humana, y un panel familiar para verlo todo desde tu teléfono.',
    ),
    testimonialsTitle: t('testimonials-title', 'La paz mental se nota.'),
    whatIsTitle: t('what-is-title', 'Tecnología y respuesta humana, juntas.'),
    whatIsBody: t(
      'what-is-body',
      'Angela es un dispositivo portátil con conexión celular propia. Al presionar el botón SOS, conecta directamente con nuestro centro de atención — un operador real recibe la alerta, evalúa la situación, y coordina la ayuda. La familia no tiene que hacerlo sola.',
    ),
    howItWorksTitle: t('how-it-works-title', 'Tres pasos y listo.'),
    productTitle: t('product-title', 'Pequeño, ligero, siempre conectado.'),
    productBody: t(
      'product-body',
      'Diseñado para llevarlo todo el día sin pensarlo. Funciona con red celular propia — no necesita un teléfono cerca, no necesita Wi-Fi de casa.',
    ),
    dayTitle: t('day-title', 'Un día típico con Sensu.'),
    daySubtitle: t(
      'day-subtitle',
      'La protección es más útil cuando se siente invisible. Así se ve un día normal de tu familiar y de tu tranquilidad.',
    ),
    coverageTitle: t(
      'coverage-title',
      'Cobertura nacional, respuesta humana en español.',
    ),
    coverageBody: t(
      'coverage-body',
      'Operamos con call center propio en México, en horario mexicano, con operadores que conocen los servicios médicos locales y hablan tu idioma desde el primer segundo.',
    ),
    plansTitle: t('plans-title', 'Elige la protección que necesitas.'),
    plansSubtitle: t(
      'plans-subtitle',
      'Cancela cuando quieras. Sin contratos largos, sin sorpresas.',
    ),
    whyTitle: t('why-title', 'Cuatro razones, en orden de importancia.'),
    faqTitle: t('faq-title', 'Preguntas frecuentes.'),
    faqSubtitle: t(
      'faq-subtitle',
      'Lo que más nos preguntan las familias que ya usan Sensu.',
    ),
    footerCtaTitle: t('footer-cta-title', 'Empieza hoy. Cuídalos siempre.'),
    footerCtaBody: t(
      'footer-cta-body',
      'Activa Sensu en minutos. Sin contratos, con un equipo humano que responde 24/7.',
    ),
  };
  const heroSubtitle = txt.heroSubtitle;

  return (
    <main
      data-testid="nucleus-home"
      className="flex flex-1 flex-col items-center px-6"
    >
      {/* HERO ---------------------------------------------------------- */}
      {(() => {
        const heroPhoneVideo = vid('hero-phone-video', {
          url: 'https://res.cloudinary.com/dcfjvxt5h/video/upload/v1780582705/sensu/landing/para-mi-promo.mov',
        });
        const heroPhonePoster = heroPhoneVideo.url
          .replace(
            /\/video\/upload\/(v\d+\/)?/,
            '/video/upload/so_0,f_jpg,q_auto/$1',
          )
          .replace(/\.[a-z0-9]+$/i, '.jpg');
        return (
          <section
            data-testid="home-hero"
            className="relative isolate flex min-h-screen w-full items-center justify-center overflow-hidden py-16 sm:py-20"
          >
            {isAdmin && (
              <CardEditPencil
                slugBase="hero"
                modalTitle="Editar hero"
                fields={[
                  { key: 'title', label: 'Título', type: 'multiline', initial: txt.heroTitle },
                  { key: 'subtitle', label: 'Subtítulo', type: 'multiline', initial: txt.heroSubtitle },
                  {
                    key: 'phone-video',
                    label: 'Video del teléfono (YouTube / Vimeo / Cloudinary / MP4)',
                    type: 'video',
                    initial: heroPhoneVideo.url,
                    slug: 'hero-phone-video',
                  },
                ]}
                className="absolute right-6 top-6 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-sensu-600 shadow-sm ring-1 ring-inset ring-zinc-200 hover:opacity-100 cursor-pointer"
              />
            )}
            <div
              data-testid="home-hero-content"
              className="relative mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16"
            >
              <div className="text-center lg:text-left">
                <span className="inline-flex items-center gap-2 rounded-full bg-sensu-50 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-sensu-700 ring-1 ring-sensu-100 animate-fade-up">
                  <LuHeart aria-hidden className="h-3.5 w-3.5 text-sensu-500" />
                  Monitoreo 24/7 · Respuesta humana
                </span>
                <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-zinc-900 animate-fade-up [animation-delay:80ms] whitespace-pre-wrap">
                  {txt.heroTitle}
                </h1>
                <p className="mt-6 max-w-2xl text-base sm:text-lg leading-relaxed text-zinc-600 animate-fade-up [animation-delay:160ms] whitespace-pre-wrap lg:mx-0 mx-auto">
                  {heroSubtitle}
                </p>
                <div className="mt-9 flex flex-wrap items-center justify-center gap-3 animate-fade-up [animation-delay:240ms] lg:justify-start">
                  <Link
                    href="#planes"
                    data-testid="home-cta-primary"
                    className="inline-flex h-12 items-center gap-2 rounded-full bg-sensu-500 px-7 text-sm font-medium tracking-tight text-white shadow-[0_10px_30px_rgba(244,63,94,0.35)] transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
                  >
                    Elegir plan
                    <LuArrowRight aria-hidden className="h-4 w-4" />
                  </Link>
                  <Link
                    href="https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ3u5g0AEYzEE6mHeXFmHtlrAqQl9V8a1CcHvoAG4BS6Y3uwnl29PxP5OZiSntj3iD8W1TdzV9e8"
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="home-cta-demo"
                    className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-7 text-sm font-medium tracking-tight text-zinc-700 ring-1 ring-zinc-200 transition-colors hover:bg-zinc-50"
                  >
                    <LuCalendar aria-hidden className="h-4 w-4" />
                    Solicita tu demo
                  </Link>
                </div>
                <p className="mt-6 text-sm text-zinc-600 animate-fade-up [animation-delay:300ms]">
                  ¿Un familiar tuyo ya usa Sensu?{' '}
                  <Link
                    href="/signup/familiar"
                    data-testid="home-cta-family"
                    className="font-medium text-sensu-600 transition-colors hover:text-sensu-500 underline-offset-4 hover:underline"
                  >
                    Únete como observador
                  </Link>
                  {' '}con el ID que te compartió.
                </p>
              </div>
              <div className="flex items-center justify-center">
                <HeroPhone
                  videoUrl={heroPhoneVideo.url}
                  posterUrl={heroPhonePoster}
                />
              </div>
            </div>
          </section>
        );
      })()}

      {/* INTRO VIDEO — Juan's landing-redesign doc 2026-06-03 asked for a
          prominent video slot below the hero, mirroring the YouTube
          embed that lived on the prior Lovable site (image2.png of the
          doc). Defaults to the Sensu Angela reel; controls are visible
          so the visitor can pause / re-watch. Admin swaps via the
          inline CMS using any YouTube / Vimeo / Cloudinary URL. */}
      <section
        data-testid="home-intro-video"
        className="w-full max-w-5xl py-10"
      >
        {(() => {
          const introVideo = vid('intro-video', {
            url: 'https://www.youtube.com/watch?v=AV6qTP3RiLc',
          });
          return (
            <div className="relative">
              {isAdmin && (
                <CardEditPencil
                  slugBase="intro-video"
                  modalTitle="Editar video de introducción"
                  fields={[
                    {
                      key: 'video',
                      label: 'URL del video (YouTube / Vimeo / Cloudinary / MP4)',
                      type: 'video',
                      initial: introVideo.url,
                      slug: 'intro-video',
                    },
                  ]}
                />
              )}
              <LandingVideo
                url={introVideo.url}
                title="Conoce Sensu Angela"
                controls
                testId="home-intro-video-player"
              />
            </div>
          );
        })()}
      </section>

      {/* TESTIMONIALS — real families, real protection ------------------ */}
      <section
        data-testid="home-testimonials"
        className="w-full max-w-5xl py-12"
      >
        <p className="flex items-center justify-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
          <LuStar aria-hidden className="h-3.5 w-3.5 text-amber-500" />
          Familias que ya duermen tranquilas
        </p>
        <div className="relative mt-3 inline-block w-full">
          {isAdmin && (
            <CardEditPencil
              slugBase="testimonials"
              modalTitle="Editar testimonios"
              fields={[
                { key: 'title', label: 'Título', type: 'text', initial: txt.testimonialsTitle },
              ]}
            />
          )}
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 text-center">
            {txt.testimonialsTitle}
          </h2>
        </div>
        <TestimonialCarousel
          isAdmin={isAdmin}
          items={[
            {
              slug: 'testimonial-1',
              quote: t(
                'testimonial-1-quote',
                'Mi mamá presionó el botón a las 3 de la mañana. El call center la conectó con mi hermano en 15 segundos. Ya no me despierto pensando "¿estará bien?".',
              ),
              name: t('testimonial-1-name', 'María González'),
              relation: t('testimonial-1-relation', 'Hija · Ciudad de México'),
              photo: img('testimonial-1-photo', {
                url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=240&q=80&auto=format&fit=crop',
                alt: 'María González',
              }).url,
            },
            {
              slug: 'testimonial-2',
              quote: t(
                'testimonial-2-quote',
                'Mi abuela vuelve a salir a caminar al parque sin que toda la familia se preocupe. Ese cambio no se paga con dinero.',
              ),
              name: t('testimonial-2-name', 'Roberto Hernández'),
              relation: t('testimonial-2-relation', 'Nieto · Guadalajara'),
              photo: img('testimonial-2-photo', {
                url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=240&q=80&auto=format&fit=crop',
                alt: 'Roberto Hernández',
              }).url,
            },
            {
              slug: 'testimonial-3',
              quote: t(
                'testimonial-3-quote',
                'Sensu es lo mejor que le hemos dado a mi suegra. Y a nosotros también. Saber que hay alguien al otro lado del botón cambia todo.',
              ),
              name: t('testimonial-3-name', 'Patricia Ramírez'),
              relation: t('testimonial-3-relation', 'Nuera · Monterrey'),
              photo: img('testimonial-3-photo', {
                url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=240&q=80&auto=format&fit=crop',
                alt: 'Patricia Ramírez',
              }).url,
            },
            {
              slug: 'testimonial-4',
              quote: t(
                'testimonial-4-quote',
                'Mi papá detesta sentirse vigilado. Con Sensu lleva el botón como un reloj y nunca se entera de mi ojo encima. Eso me deja vivir mi día sin culpa.',
              ),
              name: t('testimonial-4-name', 'Carlos Mendoza'),
              relation: t('testimonial-4-relation', 'Hijo · Puebla'),
              photo: img('testimonial-4-photo', {
                url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=240&q=80&auto=format&fit=crop',
                alt: 'Carlos Mendoza',
              }).url,
            },
            {
              slug: 'testimonial-5',
              quote: t(
                'testimonial-5-quote',
                'La primera vez fue falsa alarma — el botón se atoró en el bolsillo. El operador llamó, confirmó que todo estaba bien, y siguió con su día. Ahí sentí que sí hay alguien del otro lado.',
              ),
              name: t('testimonial-5-name', 'Lucía Torres'),
              relation: t('testimonial-5-relation', 'Hija · Querétaro'),
              photo: img('testimonial-5-photo', {
                url: 'https://images.unsplash.com/photo-1607746882042-944635dfe10e?w=240&q=80&auto=format&fit=crop',
                alt: 'Lucía Torres',
              }).url,
            },
            {
              slug: 'testimonial-6',
              quote: t(
                'testimonial-6-quote',
                'Trabajo en la frontera y mi mamá vive sola en Mérida. Antes de Sensu no dormía corrido. Ahora sí — y eso lo vale todo.',
              ),
              name: t('testimonial-6-name', 'Fernando Aguilar'),
              relation: t('testimonial-6-relation', 'Hijo · Mérida'),
              photo: img('testimonial-6-photo', {
                url: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=240&q=80&auto=format&fit=crop',
                alt: 'Fernando Aguilar',
              }).url,
            },
          ]}
        />
      </section>

      {/* REVIEW VIDEOS — Juan's landing-redesign doc 2026-06-03 asked
          for 2–3 family video reviews below the testimonial carousel.
          Redesigned 2026-06-04 per Ustym's polish review: empty defaults
          (no triplicate Cloudinary loop), each card carries name +
          relation text fields matching the testimonial-carousel
          aesthetic, and cards with no video URL are hidden for
          visitors. Admins always see all three slots so they can drop
          a real review URL in via the inline CMS — they get a clear
          placeholder until they do. The whole section disappears for
          visitors when none of the slots have content yet, so the
          landing page never shows three empty rectangles. */}
      <section
        data-testid="home-review-videos"
        className="w-full max-w-5xl py-12"
      >
        {(() => {
          const reviewTitle = t(
            'review-videos-title',
            'Mira lo que dicen las familias.',
          );
          const reviewSubtitle = t(
            'review-videos-subtitle',
            'Historias reales de familias que confían en Sensu Angela todos los días.',
          );
          const reviews = [1, 2, 3].map((i) => ({
            slug: `review-video-${i}`,
            videoUrl: vid(`review-video-${i}`, { url: '' }).url,
            name: t(`review-video-${i}-name`, ''),
            relation: t(`review-video-${i}-relation`, ''),
          }));
          // 2026-06-04 — Ustym asked for the three review-video cards
          // to always be visible (Juan's doc explicitly asked for the
          // section to exist as a placeholder). Earlier I made empty
          // cards hide for non-admin visitors, which left the page with
          // no review section at all when no URLs were populated. That
          // was too clever. Render all three slots regardless of role
          // and admin role; visitors see clean placeholder posters
          // until real reviews are uploaded.
          const visibleReviews = reviews;
          return (
            <>
              <div className="relative text-center">
                {isAdmin && (
                  <CardEditPencil
                    slugBase="review-videos-title"
                    modalTitle="Editar encabezado de reseñas en video"
                    fields={[
                      {
                        key: 'title',
                        label: 'Título',
                        type: 'text',
                        initial: reviewTitle,
                        slug: 'review-videos-title',
                      },
                      {
                        key: 'subtitle',
                        label: 'Subtítulo',
                        type: 'multiline',
                        initial: reviewSubtitle,
                        slug: 'review-videos-subtitle',
                      },
                    ]}
                  />
                )}
                <p className="flex items-center justify-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
                  <LuStar aria-hidden className="h-3.5 w-3.5 text-amber-500" />
                  En sus propias palabras
                </p>
                <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 whitespace-pre-wrap">
                  {reviewTitle}
                </h2>
                <p className="mx-auto mt-3 max-w-2xl text-sm sm:text-base text-zinc-600 whitespace-pre-wrap">
                  {reviewSubtitle}
                </p>
              </div>
              <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {visibleReviews.map((r, i) => {
                  const populated = !!r.videoUrl;
                  return (
                    <article
                      key={r.slug}
                      data-testid={`home-review-video-${i + 1}`}
                      className="card-surface card-surface-hoverable group relative flex flex-col overflow-hidden rounded-3xl p-4 hover:-translate-y-1 animate-rise"
                      style={{ animationDelay: `${i * 80}ms` }}
                    >
                      {isAdmin && (
                        <CardEditPencil
                          slugBase={r.slug}
                          modalTitle={`Editar reseña en video ${i + 1}`}
                          fields={[
                            {
                              key: 'video',
                              label: 'URL del video (YouTube / Vimeo / Cloudinary / MP4)',
                              type: 'video',
                              initial: r.videoUrl,
                              slug: r.slug,
                            },
                            {
                              key: 'name',
                              label: 'Nombre',
                              type: 'text',
                              initial: r.name,
                              slug: `${r.slug}-name`,
                              placeholder: 'p. ej. María González',
                            },
                            {
                              key: 'relation',
                              label: 'Relación · Ciudad',
                              type: 'text',
                              initial: r.relation,
                              slug: `${r.slug}-relation`,
                              placeholder: 'p. ej. Hija · Ciudad de México',
                            },
                          ]}
                        />
                      )}
                      {populated ? (
                        // 2026-06-04 — switched from inline LandingVideo
                        // to MediaLightbox so clicking the thumbnail
                        // opens the video full-viewport in a portal,
                        // matching the /soporte article video pattern.
                        // The thumbnail shows a dark gradient with a
                        // centered play button; click anywhere in the
                        // card opens the fullscreen player.
                        <MediaLightbox
                          imageUrl={null}
                          videoUrl={r.videoUrl}
                          title={r.name || `Reseña en video ${i + 1}`}
                          testId={`home-review-video-${i + 1}`}
                        />
                      ) : (
                        <div
                          data-testid={`home-review-video-${i + 1}-placeholder`}
                          className={`flex aspect-video w-full items-center justify-center rounded-2xl text-center text-xs text-zinc-500 ${
                            isAdmin
                              ? 'bg-zinc-50 ring-1 ring-dashed ring-zinc-200'
                              : 'bg-gradient-to-br from-zinc-100 to-zinc-50'
                          }`}
                        >
                          {isAdmin ? 'Pega aquí el URL de la reseña' : 'Próximamente'}
                        </div>
                      )}
                      {(r.name || r.relation || isAdmin) && (
                        <div className="mt-4 px-2 pb-2 text-left">
                          <p className="text-sm font-semibold text-zinc-900">
                            {r.name || (isAdmin ? 'Sin nombre' : '')}
                          </p>
                          {(r.relation || isAdmin) && (
                            <p className="mt-0.5 text-xs text-zinc-500">
                              {r.relation || (isAdmin ? 'Sin relación' : '')}
                            </p>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </>
          );
        })()}
      </section>

      {/* WHAT IS SENSU — five-card explainer ----------------------------- */}
      <section
        id="que-es"
        data-testid="home-what-is"
        className="w-full max-w-4xl py-12"
      >
        <div className="relative">
          {isAdmin && (
            <CardEditPencil
              slugBase="what-is"
              modalTitle="Editar sección — ¿Qué es Sensu?"
              fields={[
                { key: 'title', label: 'Título', type: 'text', initial: txt.whatIsTitle },
                { key: 'body', label: 'Cuerpo', type: 'multiline', initial: txt.whatIsBody },
              ]}
            />
          )}
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 text-center">
            {txt.whatIsTitle}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm sm:text-base text-zinc-600 whitespace-pre-wrap">
            {txt.whatIsBody}
          </p>
        </div>
        {/* ZIGZAG ROWS — 5 alternating image-left/text-right rows.
            Rebuild 2026-06-04 per Ustym's design direction: replace the
            3-column grid with a staircase pattern so each card gets a
            full-bleed image alongside its copy. Inline CMS pencils
            preserved per card (title + body + image), with default
            image URLs preset to the Cloudinary mirrors of the
            Lovable-site assets. Juan swaps any image via the inline
            CMS without touching code. */}
        <div className="mt-12 space-y-16 sm:space-y-20">
          {[
            {
              slug: 'what-is-card-1',
              icon: LuRadio,
              tone: 'text-sensu-500',
              title: 'Dispositivo Angela',
              body:
                'GPS + botón SOS + llamadas bidireccionales. Conexión celular propia, no necesita el teléfono cerca.',
              defaultImage:
                'https://res.cloudinary.com/dcfjvxt5h/image/upload/v1780521540/sensu/landing/angela-esencial-hero.png',
            },
            {
              slug: 'what-is-card-2',
              icon: LuHeadphones,
              tone: 'text-sky-500',
              title: 'Call Center 24/7',
              body:
                'Operadores humanos siempre disponibles, con el historial médico y los contactos de emergencia listos en pantalla.',
              defaultImage:
                'https://res.cloudinary.com/dcfjvxt5h/image/upload/v1780574332/sensu/landing/app-screen-1.jpg',
            },
            {
              slug: 'what-is-card-3',
              icon: LuSmartphone,
              tone: 'text-violet-500',
              title: 'Panel familiar',
              body:
                'Ubicación en tiempo real, alertas y geo-cercas desde el celular o la computadora.',
              defaultImage:
                'https://res.cloudinary.com/dcfjvxt5h/image/upload/v1780574333/sensu/landing/app-screen-2.jpg',
            },
            {
              slug: 'what-is-card-4',
              icon: LuActivity,
              tone: 'text-amber-500',
              title: 'Detección de caídas',
              body:
                'El sensor reconoce caídas y lanza la alerta automáticamente, sin que el usuario haga nada.',
              defaultImage:
                'https://res.cloudinary.com/dcfjvxt5h/image/upload/v1780574333/sensu/landing/app-screen-3.jpg',
            },
            {
              slug: 'what-is-card-5',
              icon: LuStethoscope,
              tone: 'text-emerald-500',
              title: 'Asistencias integrales',
              body:
                'Asistencia médica, psicológica, nutricional, vial y de hogar. Te ayudamos en cualquier situación.',
              defaultImage:
                'https://res.cloudinary.com/dcfjvxt5h/image/upload/v1780574334/sensu/landing/app-screen-4.jpg',
            },
          ].map((card, i) => {
            const Icon = card.icon;
            const cardTitle = t(`${card.slug}-title`, card.title);
            const cardBody = t(`${card.slug}-body`, card.body);
            const cardImage = img(`${card.slug}-image`, {
              url: card.defaultImage,
              alt: card.title,
            });
            const reversed = i % 2 === 1; // zigzag: odd rows flip
            return (
              <div
                key={card.slug}
                data-testid={card.slug}
                className="relative grid items-center gap-8 sm:grid-cols-2 sm:gap-14 animate-fade-up"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                {isAdmin && (
                  <CardEditPencil
                    slugBase={card.slug}
                    modalTitle="Editar tarjeta"
                    fields={[
                      { key: 'title', label: 'Título', type: 'text', initial: cardTitle },
                      { key: 'body', label: 'Cuerpo', type: 'multiline', initial: cardBody },
                      { key: 'image', label: 'Imagen', type: 'image', initial: cardImage.url },
                    ]}
                  />
                )}
                {/* Image column — order swaps on every other row to
                    produce the zigzag staircase on sm+ viewports. On
                    mobile, image always comes first for natural reading
                    order. */}
                <div className={reversed ? 'sm:order-2' : ''}>
                  <div className="relative">
                    {/* Soft halo behind the image, matching the hero
                        treatment so the section reads as one family. */}
                    <div
                      aria-hidden
                      className={`absolute inset-0 -m-6 rounded-[2.5rem] blur-2xl ${
                        i % 2 === 0 ? 'bg-sensu-100/40' : 'bg-sky-100/40'
                      }`}
                    />
                    <img
                      src={cardImage.url}
                      alt={cardImage.alt}
                      loading="lazy"
                      className="relative aspect-[4/3] w-full object-cover"
                    />
                  </div>
                </div>
                {/* Text column — opposite order. */}
                <div className={reversed ? 'sm:order-1' : ''}>
                  <span
                    aria-hidden
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-full bg-zinc-50 ${card.tone}`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900">
                    {cardTitle}
                  </h3>
                  <p className="mt-3 text-base leading-relaxed text-zinc-600 whitespace-pre-wrap">
                    {cardBody}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* HOW IT WORKS -------------------------------------------------- */}
      <section
        id="como-funciona"
        data-testid="home-how-it-works"
        className="w-full max-w-4xl py-12"
      >
        <div className="relative">
          {isAdmin && (
            <CardEditPencil
              slugBase="how-it-works"
              modalTitle="Editar sección — Cómo funciona"
              fields={[
                { key: 'title', label: 'Título', type: 'text', initial: txt.howItWorksTitle },
              ]}
            />
          )}
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 text-center">
            {txt.howItWorksTitle}
          </h2>
        </div>
        {/* Timeline-style row — 2026-06-04 rebuild per Ustym's reference
            (Replacement Process Timeline screenshot). Replaced the
            3-card grid with a horizontal sequence of numbered pastel
            circles + title + short description, evenly spaced.
            Inline-CMS pencils preserved per step (title + body). */}
        <ol className="mt-12 grid gap-10 text-center sm:grid-cols-3 sm:gap-6">
          {[
            {
              slug: 'how-it-works-step-1',
              title: 'Recibe la Angela',
              body:
                'Llega a tu casa y el call center lo activa a nombre de tu familiar en minutos.',
              circle: 'bg-rose-50 text-rose-600 ring-rose-200',
            },
            {
              slug: 'how-it-works-step-2',
              title: 'Tu familiar lo lleva siempre',
              body:
                'GPS, detección de caída y batería de larga duración. Funciona en todo México.',
              circle: 'bg-amber-50 text-amber-600 ring-amber-200',
            },
            {
              slug: 'how-it-works-step-3',
              title: 'Tú lo ves todo en el panel',
              body:
                'Ubicación en tiempo real, alertas instantáneas y un equipo humano 24/7.',
              circle: 'bg-emerald-50 text-emerald-600 ring-emerald-200',
            },
          ].map((step, i) => {
            const stepTitle = t(`${step.slug}-title`, step.title);
            const stepBody = t(`${step.slug}-body`, step.body);
            return (
              <li
                key={step.slug}
                data-testid={`home-step-${i + 1}`}
                className="relative flex flex-col items-center animate-fade-up"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                {isAdmin && (
                  <CardEditPencil
                    slugBase={step.slug}
                    modalTitle={`Editar paso ${i + 1}`}
                    fields={[
                      { key: 'title', label: 'Título', type: 'text', initial: stepTitle },
                      { key: 'body', label: 'Cuerpo', type: 'multiline', initial: stepBody },
                    ]}
                  />
                )}
                <span
                  aria-hidden
                  className={`flex h-14 w-14 items-center justify-center rounded-full text-xl font-semibold ring-1 ${step.circle}`}
                >
                  {i + 1}
                </span>
                <p className="mt-5 text-base font-semibold tracking-tight text-zinc-900">
                  {stepTitle}
                </p>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-zinc-600 whitespace-pre-wrap">
                  {stepBody}
                </p>
              </li>
            );
          })}
        </ol>
      </section>

      {/* PRODUCT SHOWCASE — El dispositivo Angela ----------------------- */}
      <section
        data-testid="home-product"
        className="w-full max-w-5xl py-12"
      >
        <div className="grid items-center gap-10 sm:grid-cols-2 sm:gap-12">
          {(() => {
            const productImage = img('product-image', {
              url: 'https://images.unsplash.com/photo-1737061527113-6b0f90b0905a?w=900&q=80&auto=format&fit=crop',
              alt: 'Dispositivo Sensu sostenido en una mano',
            });
            return (
              <div className="relative">
                {isAdmin && (
                  <CardEditPencil
                    slugBase="product-image"
                    modalTitle="Editar imagen del producto"
                    fields={[
                      {
                        key: 'image',
                        label: 'Imagen',
                        type: 'image',
                        initial: productImage.url,
                        // Render reads `img('product-image', ...)`, so we pin
                        // the persisted slug to the slugBase directly instead
                        // of letting saveLandingFields produce the stuttering
                        // `product-image-image`.
                        slug: 'product-image',
                      },
                    ]}
                  />
                )}
                <img
                  src={productImage.url}
                  alt={productImage.alt}
                  loading="lazy"
                  // CSS mask-image with a bottom linear-gradient gives a
                  // smooth fade at the bottom edge — the image dissolves
                  // into the page background instead of ending with a
                  // hard line. No border, no shadow, no rounded corner —
                  // just the mask doing the smoothing work.
                  className="relative aspect-[4/3] w-full object-cover [mask-image:linear-gradient(to_bottom,black_72%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,black_72%,transparent_100%)]"
                />
              </div>
            );
          })()}
          <div className="text-center sm:text-left">
            <p className="flex items-center justify-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500 sm:justify-start">
              <LuShield aria-hidden className="h-3.5 w-3.5 text-sensu-500" />
              El dispositivo Angela
            </p>
            <div className="relative">
              {isAdmin && (
                <CardEditPencil
                  slugBase="product"
                  modalTitle="Editar sección — Producto"
                  fields={[
                    { key: 'title', label: 'Título', type: 'multiline', initial: txt.productTitle },
                    { key: 'body', label: 'Cuerpo', type: 'multiline', initial: txt.productBody },
                  ]}
                />
              )}
              <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 whitespace-pre-wrap">
                {txt.productTitle}
              </h2>
              <p className="mt-4 text-base sm:text-lg leading-relaxed text-zinc-600 whitespace-pre-wrap">
                {txt.productBody}
              </p>
            </div>
            <dl className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                { slug: 'product-spec-1', icon: LuMapPin, tone: 'text-emerald-500', label: 'GPS preciso', desc: 'Ubicación en tiempo real en todo México.' },
                { slug: 'product-spec-2', icon: LuBatteryFull, tone: 'text-sky-500', label: 'Batería 5 días', desc: 'Te avisamos antes de que se acabe.' },
                { slug: 'product-spec-3', icon: LuRadio, tone: 'text-rose-500', label: 'Botón SOS', desc: 'Una pulsación, el call center responde.' },
                { slug: 'product-spec-4', icon: LuWaves, tone: 'text-violet-500', label: 'Resistente IP67', desc: 'Soporta lluvia, sudor, salpicaduras.' },
              ].map((spec) => {
                const Icon = spec.icon;
                const specLabel = t(`${spec.slug}-label`, spec.label);
                const specDesc = t(`${spec.slug}-desc`, spec.desc);
                return (
                  <div key={spec.slug} className="card-surface relative rounded-2xl p-4">
                    {isAdmin && (
                      <CardEditPencil
                        slugBase={spec.slug}
                        modalTitle="Editar especificación"
                        fields={[
                          { key: 'label', label: 'Etiqueta', type: 'text', initial: specLabel },
                          { key: 'desc', label: 'Descripción', type: 'multiline', initial: specDesc },
                        ]}
                        className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-sensu-600 opacity-80 shadow-sm ring-1 ring-inset ring-sensu-200 transition-opacity hover:opacity-100 cursor-pointer"
                      />
                    )}
                    <div className="flex items-center gap-2">
                      <Icon aria-hidden className={`h-4 w-4 ${spec.tone}`} />
                      <p className="text-sm font-medium tracking-tight text-zinc-900">
                        {specLabel}
                      </p>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-600 whitespace-pre-wrap">
                      {specDesc}
                    </p>
                  </div>
                );
              })}
            </dl>
          </div>
        </div>
      </section>

      {/* DAY IN THE LIFE — narrative with three image cards ------------- */}
      <section
        data-testid="home-day"
        className="w-full max-w-5xl py-12"
      >
        <div className="relative">
          {isAdmin && (
            <CardEditPencil
              slugBase="day"
              modalTitle="Editar sección — Un día con Sensu"
              fields={[
                { key: 'title', label: 'Título', type: 'text', initial: txt.dayTitle },
                { key: 'subtitle', label: 'Subtítulo', type: 'multiline', initial: txt.daySubtitle },
              ]}
            />
          )}
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 text-center">
            {txt.dayTitle}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm sm:text-base text-zinc-600 whitespace-pre-wrap">
            {txt.daySubtitle}
          </p>
        </div>
        <ol className="mt-10 grid gap-5 sm:grid-cols-3">
          {[
            {
              slug: 'day-moment-1',
              icon: LuSunMedium,
              tone: 'text-amber-500',
              title: 'Mañana — Sale al mercado',
              body:
                'Tu mamá toma su café, agarra su Angela y sale al mercado de la esquina. Tú ves su ubicación desde tu oficina sin tener que llamarla.',
              photo: 'https://images.unsplash.com/photo-1599234032928-51b690214c8f?w=800&q=80&auto=format&fit=crop',
            },
            {
              slug: 'day-moment-2',
              icon: LuMapPin,
              tone: 'text-emerald-500',
              title: 'Tarde — Camina en el parque',
              body:
                'Si pasa de la geo-cerca del parque, te llega una notificación. Si tropieza, el sensor detecta la caída y dispara la alerta sin que ella tenga que presionar nada.',
              photo: 'https://images.unsplash.com/photo-1766524555239-245d78f3b3a2?w=800&q=80&auto=format&fit=crop',
            },
            {
              slug: 'day-moment-3',
              icon: LuSunset,
              tone: 'text-violet-500',
              title: 'Noche — Cena en familia',
              body:
                'La cena tranquila. Tu mamá te muestra el botón y dice "ni me acuerdo que lo traigo". Esa es la idea.',
              photo: 'https://images.unsplash.com/photo-1578496780896-7081cc23c111?w=800&q=80&auto=format&fit=crop',
            },
          ].map((moment, i) => {
            const Icon = moment.icon;
            const photo = img(`${moment.slug}-photo`, {
              url: moment.photo,
              alt: '',
            });
            const momentTitle = t(`${moment.slug}-title`, moment.title);
            const momentBody = t(`${moment.slug}-body`, moment.body);
            return (
              <li
                key={moment.slug}
                className="card-surface relative overflow-hidden rounded-3xl animate-rise"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                {isAdmin && (
                  <CardEditPencil
                    slugBase={moment.slug}
                    modalTitle={`Editar momento ${i + 1}`}
                    fields={[
                      { key: 'title', label: 'Título', type: 'text', initial: momentTitle },
                      { key: 'body', label: 'Cuerpo', type: 'multiline', initial: momentBody },
                      { key: 'photo', label: 'Foto', type: 'image', initial: photo.url },
                    ]}
                  />
                )}
                <img
                  src={photo.url}
                  alt={photo.alt}
                  loading="lazy"
                  className="aspect-[4/3] w-full object-cover"
                />
                <div className="p-6">
                  <div className="flex items-center gap-2">
                    <Icon aria-hidden className={`h-4 w-4 ${moment.tone}`} />
                    <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                      Paso {i + 1}
                    </p>
                  </div>
                  <p className="mt-2 text-base font-semibold tracking-tight text-zinc-900">
                    {momentTitle}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600 whitespace-pre-wrap">
                    {momentBody}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {/* COVERAGE — Hecho para México ----------------------------------- */}
      <section
        data-testid="home-coverage"
        className="w-full max-w-5xl py-12"
      >
        <div className="grid items-center gap-10 sm:grid-cols-2 sm:gap-12">
          <div className="text-center sm:text-left order-2 sm:order-1">
            <p className="flex items-center justify-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500 sm:justify-start">
              <LuMapPinned aria-hidden className="h-3.5 w-3.5 text-emerald-500" />
              Hecho para México
            </p>
            <div className="relative">
              {isAdmin && (
                <CardEditPencil
                  slugBase="coverage"
                  modalTitle="Editar sección — Cobertura"
                  fields={[
                    { key: 'title', label: 'Título', type: 'multiline', initial: txt.coverageTitle },
                    { key: 'body', label: 'Cuerpo', type: 'multiline', initial: txt.coverageBody },
                  ]}
                />
              )}
              <h2 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 whitespace-pre-wrap">
                {txt.coverageTitle}
              </h2>
              <p className="mt-4 text-base leading-relaxed text-zinc-600 whitespace-pre-wrap">
                {txt.coverageBody}
              </p>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4 text-center sm:text-left">
              {[
                { num: '32', unit: 'estados', desc: 'cobertura nacional vía red celular' },
                { num: '24/7', unit: 'siempre', desc: 'sin festivos, sin noches sin guardia' },
                { num: '< 30s', unit: 'respuesta', desc: 'tiempo promedio del operador' },
                { num: '100%', unit: 'mexicano', desc: 'operación local, datos en México' },
              ].map((stat) => (
                <div key={stat.unit} className="card-surface rounded-2xl p-4">
                  <p className="text-2xl font-semibold tracking-tight text-sensu-500 tabular-nums">
                    {stat.num}
                  </p>
                  <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                    {stat.unit}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-600">
                    {stat.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
          {(() => {
            const coverageImage = img('coverage-image', {
              url: 'https://images.unsplash.com/photo-1518105779142-d975f22f1b0a?w=900&q=80&auto=format&fit=crop',
              alt: 'Paisaje mexicano',
            });
            return (
              <div className="relative order-1 sm:order-2">
                <div className="absolute inset-0 -m-6 rounded-[2.5rem] bg-emerald-100/40" style={{ filter: 'blur(50px)' }} />
                {isAdmin && (
                  <CardEditPencil
                    slugBase="coverage-image"
                    modalTitle="Editar imagen de cobertura"
                    fields={[
                      {
                        key: 'image',
                        label: 'Imagen',
                        type: 'image',
                        initial: coverageImage.url,
                        // See product-image comment — pin to slugBase so the
                        // save/render slug matches.
                        slug: 'coverage-image',
                      },
                    ]}
                  />
                )}
                <img
                  src={coverageImage.url}
                  alt={coverageImage.alt}
                  loading="lazy"
                  className="relative aspect-[4/3] w-full rounded-3xl object-cover shadow-[0_30px_60px_rgba(15,23,42,0.18)]"
                />
              </div>
            );
          })()}
        </div>
      </section>

      {/* PLAN PICKER --------------------------------------------------- */}
      <section
        id="planes"
        className="w-full max-w-4xl py-12"
      >
        <div className="relative">
          {isAdmin && (
            <CardEditPencil
              slugBase="plans"
              modalTitle="Editar sección — Planes"
              fields={[
                { key: 'title', label: 'Título', type: 'text', initial: txt.plansTitle },
                { key: 'subtitle', label: 'Subtítulo', type: 'multiline', initial: txt.plansSubtitle },
              ]}
            />
          )}
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 text-center">
            {txt.plansTitle}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm text-zinc-600 whitespace-pre-wrap">
            {txt.plansSubtitle}
          </p>
        </div>
        <div
          data-testid="plan-picker"
          // Cruz Roja collapse 2026-06-02 left this section with a single
          // active plan. `grid sm:grid-cols-2` slots a lone card into the
          // first column, which reads as left-aligned. When only one plan
          // renders, drop the grid and center a max-w-md card instead.
          className={
            plans.length === 1
              ? 'mt-10 mx-auto max-w-md'
              : 'mt-10 grid gap-5 sm:grid-cols-2'
          }
        >
          {plans.map((plan, i) => (
            <article
              key={plan.id}
              data-testid={`plan-${plan.type}`}
              className="card-surface card-surface-hoverable rounded-3xl p-7 hover:-translate-y-1 animate-rise"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
                  <LuShieldCheck
                    aria-hidden
                    className={`h-4 w-4 ${plan.includesAura ? 'text-violet-500' : 'text-emerald-500'}`}
                  />
                  <span data-testid={`plan-${plan.type}-name`}>{plan.name}</span>
                </p>
                {plan.isPopular && (
                  <span className="rounded-full bg-sensu-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sensu-700">
                    Más popular
                  </span>
                )}
              </div>
              <p
                data-testid={`plan-${plan.type}-price`}
                className="mt-5 text-3xl font-semibold tracking-tight text-zinc-900 tabular-nums"
              >
                {formatPriceMXN(
                  plan.priceMonthlyCents ?? plan.monthlyPriceCents,
                )}
                <span className="ml-2 align-middle text-xs font-medium tracking-normal text-zinc-500">
                  + IVA
                </span>
              </p>
              <p className="mt-3 text-sm leading-relaxed text-zinc-600">
                {plan.description}
              </p>
              <ul className="mt-5 space-y-3 text-sm text-zinc-700">
                <li className="flex items-start gap-2">
                  <LuCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <span><span className="font-medium">Dispositivo Angela incluido</span> — GPS en tiempo real, botón SOS y llamadas bidireccionales.</span>
                </li>
                <li className="flex items-start gap-2">
                  <LuCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <span><span className="font-medium">Monitoreo 24/7 con respuesta humana</span> — un operador real recibe cada alerta. No un bot.</span>
                </li>
                <li className="flex items-start gap-2">
                  <LuCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <span><span className="font-medium">App familiar</span> — ubicación en tiempo real y notificaciones cuando algo pasa.</span>
                </li>
                <li className="flex items-start gap-2">
                  <LuCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <span><span className="font-medium">Geo-cercas inteligentes</span> — alerta cuando tu familiar entra o sale de zonas seguras que tú defines.</span>
                </li>
                <li className="flex items-start gap-2">
                  <LuCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <span><span className="font-medium">Detección automática de caídas</span> — el dispositivo reconoce caídas y lanza alerta sin intervención.</span>
                </li>
                <li className="flex items-start gap-2">
                  <LuCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <span><span className="font-medium">Coordinación de emergencias</span> — ambulancia y apoyo inmediato cuando se necesita.</span>
                </li>
                {plan.includesAura && (
                  <>
                    <li className="pt-3 mt-2 border-t border-zinc-100 text-xs uppercase tracking-[0.14em] text-violet-600">
                      Beneficios exclusivos del Plan Total
                    </li>
                    <li className="flex items-start gap-2">
                      <LuCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
                      <span><span className="font-medium">Asistencia médica telefónica</span> — un médico al teléfono ante cualquier duda o síntoma.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <LuCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
                      <span><span className="font-medium">Médico a domicilio</span> — atención presencial sin salir de casa.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <LuCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
                      <span><span className="font-medium">Apoyo psicológico, nutricional y embarazo</span> — orientación especializada.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <LuCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
                      <span><span className="font-medium">Auxilio vial</span> — grúa, cambio de llanta, paso de corriente, gasolina.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <LuCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
                      <span><span className="font-medium">Asistencia para el hogar</span> — cerrajero, plomero, electricista cuando lo necesites.</span>
                    </li>
                  </>
                )}
              </ul>
              <Link
                href={`/checkout?plan=${plan.type}`}
                data-testid={`plan-${plan.type}-cta`}
                className={`mt-7 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-medium tracking-tight transition-transform hover:-translate-y-0.5 active:scale-[0.98] ${
                  plan.includesAura
                    ? 'bg-zinc-900 text-white hover:bg-zinc-800'
                    : 'bg-sensu-500 text-white hover:bg-sensu-600'
                }`}
              >
                Elegir {plan.type === 'ANGELA_TOTAL' ? 'Total' : 'Esencial'}
                <LuArrowRight aria-hidden className="h-4 w-4" />
              </Link>
            </article>
          ))}
        </div>
      </section>

      {/* EMERGENCY / PROTOCOL ----------------------------------------- */}
      <section
        id="emergencias"
        data-testid="home-emergency"
        className="w-full max-w-4xl py-12"
      >
        {(() => {
          const emergencyTitle = t(
            'emergency-title',
            'Un protocolo claro, en segundos.',
          );
          const emergencyBody = t(
            'emergency-body',
            'Hay dos formas de pedir ayuda. Las dos conectan directo con nuestro call center, con la ubicación y el historial médico ya en pantalla.',
          );
          const sosDeviceTitle = t(
            'sos-device-title',
            'Botón SOS del dispositivo',
          );
          const sosDeviceBody = t(
            'sos-device-body',
            'Tu familiar presiona el botón Angela. El dispositivo llama al call center y envía la ubicación GPS al instante, incluso sin que el familiar tenga el teléfono cerca.',
          );
          const sosAppTitle = t('sos-app-title', 'Botón SOS desde la app');
          const sosAppBody = t(
            'sos-app-body',
            'Tú o cualquier contacto de emergencia activa la alerta desde el panel familiar. El call center recibe la misma información y actúa de inmediato.',
          );
          return (
            <>
              <div className="relative">
                {isAdmin && (
                  <CardEditPencil
                    slugBase="emergency"
                    modalTitle="Editar sección — Protocolo de emergencia"
                    fields={[
                      { key: 'title', label: 'Título', type: 'text', initial: emergencyTitle },
                      { key: 'body', label: 'Cuerpo', type: 'multiline', initial: emergencyBody },
                    ]}
                  />
                )}
                <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 text-center">
                  {emergencyTitle}
                </h2>
                <p className="mx-auto mt-3 max-w-2xl text-center text-sm sm:text-base text-zinc-600 whitespace-pre-wrap">
                  {emergencyBody}
                </p>
              </div>
              {(() => {
                const sosDeviceImage = img('sos-device-image', {
                  url: 'https://res.cloudinary.com/dcfjvxt5h/image/upload/v1780582692/sensu/landing/angela-device.png',
                  alt: 'Dispositivo Angela con botón SOS',
                });
                const sosAppImage = img('sos-app-image', {
                  url: 'https://res.cloudinary.com/dcfjvxt5h/image/upload/v1780574332/sensu/landing/app-screen-1.jpg',
                  alt: 'Panel familiar Sensu — botón SOS en la app',
                });
                return (
                  <div className="mt-8 grid gap-5 sm:grid-cols-2">
                    <div
                      data-testid="home-sos-device"
                      className="card-surface relative overflow-hidden rounded-3xl p-6"
                    >
                      {isAdmin && (
                        <CardEditPencil
                          slugBase="sos-device"
                          modalTitle="Editar tarjeta — Botón SOS del dispositivo"
                          fields={[
                            { key: 'title', label: 'Título', type: 'text', initial: sosDeviceTitle },
                            { key: 'body', label: 'Cuerpo', type: 'multiline', initial: sosDeviceBody },
                            { key: 'image', label: 'Imagen', type: 'image', initial: sosDeviceImage.url },
                          ]}
                        />
                      )}
                      {sosDeviceImage.url ? (
                        <div className="-mx-6 -mt-6 mb-4 aspect-video overflow-hidden bg-zinc-50">
                          <img
                            src={sosDeviceImage.url}
                            alt={sosDeviceImage.alt}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : null}
                      <span
                        aria-hidden
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-50 text-rose-500"
                      >
                        <LuRadio className="h-5 w-5" />
                      </span>
                      <p className="mt-4 text-base font-semibold tracking-tight text-zinc-900">
                        {sosDeviceTitle}
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-zinc-600 whitespace-pre-wrap">
                        {sosDeviceBody}
                      </p>
                    </div>
                    <div
                      data-testid="home-sos-app"
                      className="card-surface relative overflow-hidden rounded-3xl p-6"
                    >
                      {isAdmin && (
                        <CardEditPencil
                          slugBase="sos-app"
                          modalTitle="Editar tarjeta — Botón SOS desde la app"
                          fields={[
                            { key: 'title', label: 'Título', type: 'text', initial: sosAppTitle },
                            { key: 'body', label: 'Cuerpo', type: 'multiline', initial: sosAppBody },
                            { key: 'image', label: 'Imagen', type: 'image', initial: sosAppImage.url },
                          ]}
                        />
                      )}
                      {sosAppImage.url ? (
                        <div className="-mx-6 -mt-6 mb-4 aspect-video overflow-hidden bg-zinc-50">
                          <img
                            src={sosAppImage.url}
                            alt={sosAppImage.alt}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : null}
                      <span
                        aria-hidden
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-50 text-rose-500"
                      >
                        <LuSmartphone className="h-5 w-5" />
                      </span>
                      <p className="mt-4 text-base font-semibold tracking-tight text-zinc-900">
                        {sosAppTitle}
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-zinc-600 whitespace-pre-wrap">
                        {sosAppBody}
                      </p>
                    </div>
                  </div>
                );
              })()}
            </>
          );
        })()}

        <div
          data-testid="home-protocol"
          className="card-surface mt-6 rounded-3xl p-6"
        >
          <p className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
            <LuShieldCheck aria-hidden className="h-4 w-4 text-emerald-500" />
            Protocolo de respuesta
          </p>
          <ol className="mt-4 grid gap-4 sm:grid-cols-2">
            {[
              {
                slug: 'protocol-step-1',
                title: 'Recepción inmediata',
                body:
                  'Un operador humano recibe la alerta en menos de 30 segundos, con el nombre, la edad y los padecimientos del usuario en pantalla.',
              },
              {
                slug: 'protocol-step-2',
                title: 'Llamada al usuario',
                body:
                  'El operador llama al dispositivo Angela para hablar con tu familiar y entender qué pasa.',
              },
              {
                slug: 'protocol-step-3',
                title: 'Coordinación de ayuda',
                body:
                  'Si la situación lo requiere, despachamos ambulancia o servicio médico, y notificamos a los contactos de emergencia.',
              },
              {
                slug: 'protocol-step-4',
                title: 'Seguimiento hasta el cierre',
                body:
                  'El operador mantiene la línea hasta que la familia o el servicio médico está en el lugar. La alerta queda registrada en tu panel.',
              },
            ].map((step, i) => {
              const stepTitle = t(`${step.slug}-title`, step.title);
              const stepBody = t(`${step.slug}-body`, step.body);
              return (
                <li key={step.slug} className="relative flex gap-3 rounded-xl p-2">
                  {isAdmin && (
                    <CardEditPencil
                      slugBase={step.slug}
                      modalTitle={`Editar paso ${i + 1}`}
                      fields={[
                        { key: 'title', label: 'Título', type: 'text', initial: stepTitle },
                        { key: 'body', label: 'Cuerpo', type: 'multiline', initial: stepBody },
                      ]}
                      className="absolute -right-1 -top-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-sensu-600 opacity-80 shadow-sm ring-1 ring-inset ring-sensu-200 transition-opacity hover:opacity-100 cursor-pointer"
                    />
                  )}
                  <span
                    aria-hidden
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sensu-50 text-sm font-semibold tabular-nums text-sensu-700 ring-1 ring-sensu-200"
                  >
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium tracking-tight text-zinc-900">
                      {stepTitle}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-zinc-600 whitespace-pre-wrap">
                      {stepBody}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* WHY FAMILIES CHOOSE SENSU — value-prop grid -------------------- */}
      <section
        data-testid="home-why"
        className="w-full max-w-5xl py-12"
      >
        <p className="flex items-center justify-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
          <LuUsers aria-hidden className="h-3.5 w-3.5 text-violet-500" />
          Por qué las familias eligen Sensu
        </p>
        <div className="relative mt-3">
          {isAdmin && (
            <CardEditPencil
              slugBase="why"
              modalTitle="Editar sección — Por qué Sensu"
              fields={[
                { key: 'title', label: 'Título', type: 'text', initial: txt.whyTitle },
              ]}
            />
          )}
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 text-center">
            {txt.whyTitle}
          </h2>
        </div>
        <ul className="mt-10 grid gap-5 sm:grid-cols-2">
          {[
            {
              slug: 'why-reason-1',
              icon: LuHeart,
              tone: 'text-rose-500',
              title: 'Confianza humana, no un bot',
              body:
                'Cada alerta la recibe una persona real, no un menú telefónico. La que llama de vuelta es una persona, la que coordina la ambulancia es una persona, la que se queda en línea contigo es una persona.',
              photo: 'https://images.unsplash.com/photo-1766066014237-00645c74e9c6?w=800&q=80&auto=format&fit=crop',
            },
            {
              slug: 'why-reason-2',
              icon: LuShield,
              tone: 'text-sensu-500',
              title: 'Tecnología que se siente invisible',
              body:
                'El dispositivo se carga una vez por semana, la app se mira cuando quieres ver dónde está tu familiar, y el resto del tiempo no piensas en ello. Esa es la idea.',
              photo: 'https://images.unsplash.com/photo-1758691030826-86a149b6278b?w=800&q=80&auto=format&fit=crop',
            },
            {
              slug: 'why-reason-3',
              icon: LuClock,
              tone: 'text-amber-500',
              title: 'Respuesta en segundos, no minutos',
              body:
                'Desde que se presiona el botón hasta que un operador habla con tu familiar pasan menos de 30 segundos en promedio. Los minutos importan; los protocolos están escritos para no perder ninguno.',
              photo: 'https://images.unsplash.com/photo-1697952431905-9c8d169d9d2b?w=800&q=80&auto=format&fit=crop',
            },
            {
              slug: 'why-reason-4',
              icon: LuUsers,
              tone: 'text-emerald-500',
              title: 'Tranquilidad para toda la familia',
              body:
                'No solo tu mamá. Tu hermano, tu cuñada, tu hija que vive en otra ciudad — todos pueden ver el panel familiar y todos reciben las alertas. La carga deja de ser de una sola persona.',
              photo: 'https://images.unsplash.com/photo-1758874960777-931053e0d9c6?w=800&q=80&auto=format&fit=crop',
            },
          ].map((reason, i) => {
            const Icon = reason.icon;
            const photo = img(`${reason.slug}-photo`, {
              url: reason.photo,
              alt: '',
            });
            const reasonTitle = t(`${reason.slug}-title`, reason.title);
            const reasonBody = t(`${reason.slug}-body`, reason.body);
            return (
              <li
                key={reason.slug}
                className="card-surface relative overflow-hidden rounded-3xl animate-rise"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                {isAdmin && (
                  <CardEditPencil
                    slugBase={reason.slug}
                    modalTitle={`Editar razón ${i + 1}`}
                    fields={[
                      { key: 'title', label: 'Título', type: 'text', initial: reasonTitle },
                      { key: 'body', label: 'Cuerpo', type: 'multiline', initial: reasonBody },
                      { key: 'photo', label: 'Foto', type: 'image', initial: photo.url },
                    ]}
                  />
                )}
                <div className="grid sm:grid-cols-5">
                  <div className="sm:col-span-2">
                    <img
                      src={photo.url}
                      alt={photo.alt}
                      loading="lazy"
                      className="h-44 w-full object-cover sm:h-full"
                    />
                  </div>
                  <div className="p-6 sm:col-span-3">
                    <div className="flex items-center gap-2">
                      <Icon aria-hidden className={`h-5 w-5 ${reason.tone}`} />
                      <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                        Razón {i + 1}
                      </p>
                    </div>
                    <p className="mt-2 text-base font-semibold tracking-tight text-zinc-900">
                      {reasonTitle}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-600 whitespace-pre-wrap">
                      {reasonBody}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* FAQ ----------------------------------------------------------- */}
      <section
        id="preguntas"
        data-testid="home-faq"
        className="w-full max-w-3xl py-12"
      >
        <div className="relative">
          {isAdmin && (
            <CardEditPencil
              slugBase="faq"
              modalTitle="Editar sección — Preguntas frecuentes"
              fields={[
                { key: 'title', label: 'Título', type: 'text', initial: txt.faqTitle },
                { key: 'subtitle', label: 'Subtítulo', type: 'multiline', initial: txt.faqSubtitle },
              ]}
            />
          )}
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 text-center">
            {txt.faqTitle}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm text-zinc-600 whitespace-pre-wrap">
            {txt.faqSubtitle}
          </p>
        </div>
        <FaqAccordion
          isAdmin={isAdmin}
          items={[
            {
              slug: 'faq-1',
              q: t('faq-1-q', '¿Qué pasa cuando mi familiar presiona el SOS?'),
              a: t(
                'faq-1-a',
                'Tu familia recibe la alerta al instante en el panel y en su teléfono. El call center llama al senior, escala con servicios de emergencia y avisa a los contactos de emergencia que tengas configurados.',
              ),
            },
            {
              slug: 'faq-2',
              q: t('faq-2-q', '¿Funciona en todo México?'),
              a: t(
                'faq-2-a',
                'Sí. El botón usa la red celular nacional y GPS, así que cubre toda la república. Para zonas sin señal, el dispositivo guarda los eventos y los envía cuando recupera conexión.',
              ),
            },
            {
              slug: 'faq-3',
              q: t('faq-3-q', '¿Cuánto dura la batería?'),
              a: t(
                'faq-3-a',
                'Hasta 5 días con uso normal. Te avisamos por adelantado cuando baje del 20 %, así nadie se queda sin protección.',
              ),
            },
            {
              slug: 'faq-4',
              q: t('faq-4-q', '¿Necesita Wi-Fi en casa?'),
              a: t(
                'faq-4-a',
                'No es obligatorio. El botón funciona con red celular incluida. El Wi-Fi mejora la precisión en interiores cuando está disponible, pero no lo necesitas para activarlo.',
              ),
            },
            {
              slug: 'faq-5',
              q: t('faq-5-q', '¿Puedo cancelar cuando quiera?'),
              a: t(
                'faq-5-a',
                'Sí. No hay contratos largos. Cancelas desde tu panel y el servicio termina al final del periodo ya pagado.',
              ),
            },
            {
              slug: 'faq-6',
              q: t('faq-6-q', '¿Es resistente al agua?'),
              a: t(
                'faq-6-a',
                'El botón soporta salpicaduras, sudor y lluvia ligera (IP67). No está pensado para sumergirlo en alberca o regadera.',
              ),
            },
          ]}
        />
      </section>

      {/* FOOTER CTA ---------------------------------------------------- */}
      <section
        data-testid="home-footer-cta"
        className="w-full max-w-3xl py-16 text-center"
      >
        <div className="relative inline-block w-full">
          {isAdmin && (
            <CardEditPencil
              slugBase="footer-cta"
              modalTitle="Editar footer CTA"
              fields={[
                { key: 'title', label: 'Título', type: 'multiline', initial: txt.footerCtaTitle },
                { key: 'body', label: 'Cuerpo', type: 'multiline', initial: txt.footerCtaBody },
              ]}
            />
          )}
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 whitespace-pre-wrap">
            {txt.footerCtaTitle}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm sm:text-base text-zinc-600 whitespace-pre-wrap">
            {txt.footerCtaBody}
          </p>
        </div>
        <Link
          href="#planes"
          data-testid="home-footer-cta-button"
          className="mt-8 inline-flex h-11 items-center gap-2 rounded-full bg-sensu-500 px-7 text-sm font-medium tracking-tight text-white transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
        >
          Elegir plan
          <LuArrowRight aria-hidden className="h-4 w-4" />
        </Link>
        <p className="mt-6 text-xs text-zinc-500">
          ¿Ya tienes cuenta?{' '}
          <Link
            href="/login"
            className="text-sensu-600 underline-offset-2 transition-colors hover:text-sensu-700 hover:underline"
          >
            Inicia sesión
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
