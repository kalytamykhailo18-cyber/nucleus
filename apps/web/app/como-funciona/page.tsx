import type { Metadata } from 'next';
import Link from 'next/link';
import {
  LuArrowRight,
  LuBatteryFull,
  LuBellRing,
  LuMapPin,
  LuPhoneCall,
  LuRadio,
  LuShieldCheck,
  LuWaves,
} from 'react-icons/lu';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { fetchLandingOverrides, pickImage, pickText } from '@/lib/landing';
import { CardEditPencil } from '@/components/card-edit-pencil';

const OG_IMAGE =
  'https://sensu.com.mx/opengraph-image';

export const metadata: Metadata = {
  title: 'Sensu Angela — ¿Cómo funciona?',
  description:
    'Un sistema de protección personal que cuida a las personas 24 horas, dentro y fuera de casa. Dispositivo portátil con botón de emergencia, GPS y centro de asistencia 24/7.',
  alternates: { canonical: '/como-funciona' },
  openGraph: {
    title: 'Sensu Angela — ¿Cómo funciona?',
    description:
      'Dispositivo portátil con botón SOS, GPS y centro de asistencia 24/7. Así funciona Sensu paso a paso.',
    url: '/como-funciona',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Dispositivo Sensu Angela' }],
  },
  twitter: { card: 'summary_large_image', images: [OG_IMAGE] },
};

export const dynamic = 'force-dynamic';

/**
 * Long-form how-it-works page (mirrors the Lovable /como-funciona route).
 * Structure:
 *   1. Hero copy block (eyebrow + title + lead + CTAs).
 *   2. "Paso a Paso" section — 4 numbered steps.
 *   3. "El dispositivo" section — 6 feature cards + pull quote.
 *   4. "App móvil" section — 4 app feature blocks.
 *   5. Final CTA section.
 *
 * The full-bleed video hero shipped in the first revision was removed
 * 2026-06-06 per Juan: "could we also eliminate this big GIF?". The
 * page now opens directly on the eyebrow + title.
 *
 * Inline CMS pencils per section let an admin swap copy without a deploy.
 */
export default async function ComoFuncionaPage(): Promise<React.ReactElement> {
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
    pickText(overrides, `como-funciona-${sub}`, fallback);

  const heroEyebrow = t('hero-eyebrow', 'Sensu Angela');
  const heroTitle = t('hero-title', '¿Cómo funciona?');
  const heroLead = t(
    'hero-lead',
    'Un sistema de protección personal que cuida a las personas las 24 horas, dentro y fuera de casa. Dispositivo portátil con botón de emergencia, detección de caídas, GPS y centro de asistencia 24/7.',
  );
  const steps = [
    {
      slug: 'step-1',
      title: 'Recibe tu dispositivo',
      body:
        'Nuestro equipo especializado evalúa la situación, contacta a tus familiares y coordina el envío de ayuda si es necesario. También enviamos asistencias psicológicas, viales, de hogar y más.',
      circle: 'bg-rose-50 text-rose-600 ring-rose-200',
    },
    {
      slug: 'step-2',
      title: 'Presiona el botón SOS',
      body:
        'En cualquier situación de emergencia, presiona el botón. La señal se envía instantáneamente a nuestro Centro de Asistencia 24/7.',
      circle: 'bg-amber-50 text-amber-600 ring-amber-200',
    },
    {
      slug: 'step-3',
      title: 'Recibe asistencia inmediata',
      body:
        'Nuestro equipo especializado evalúa la situación, contacta a tus familiares y coordina el envío de ayuda si es necesario.',
      circle: 'bg-sky-50 text-sky-600 ring-sky-200',
    },
    {
      slug: 'step-4',
      title: 'Tus familiares están informados',
      body:
        'A través de la app móvil, tus seres queridos reciben notificaciones, pueden ver tu ubicación y estar tranquilos en todo momento.',
      circle: 'bg-emerald-50 text-emerald-600 ring-emerald-200',
    },
  ];

  const deviceFeatures = [
    { slug: 'feat-sos', icon: LuRadio, title: 'Botón SOS', body: 'Presiona el botón de emergencia para conectarte instantáneamente con nuestro Centro de Asistencia 24/7. Funciona en cualquier momento, desde cualquier lugar.' },
    { slug: 'feat-gps', icon: LuMapPin, title: 'GPS en tiempo real', body: 'Localización precisa mediante GPS integrado. Tus familiares pueden ver tu ubicación en tiempo real desde la app móvil.' },
    { slug: 'feat-phone', icon: LuPhoneCall, title: 'Teléfono integrado', body: 'Envía y recibe llamadas directamente desde el dispositivo. Comunicación directa sin necesidad de un smartphone.' },
    { slug: 'feat-cell', icon: LuWaves, title: 'Conexión celular', body: 'Funciona con red celular, no necesita WiFi. Mantente conectado dentro y fuera de casa con total independencia.' },
    { slug: 'feat-battery', icon: LuBatteryFull, title: 'Batería de larga duración', body: 'Diseñado para funcionar durante días con una sola carga. Incluye alertas de batería baja para que nunca te quedes sin protección.' },
    { slug: 'feat-fall', icon: LuShieldCheck, title: 'Detección de caídas', body: 'El dispositivo detecta automáticamente caídas y envía una alerta al centro de asistencia, incluso si no puedes presionar el botón.' },
  ];

  const appFeatures = [
    {
      slug: 'app-track',
      title: 'Rastrea. Protege. Mantente conectado.',
      body: 'Monitorea el estado del dispositivo, nivel de batería, conexión y ubicación en tiempo real. Todo desde una interfaz intuitiva con botón SOS integrado.',
      bullets: ['Estado del dispositivo y nivel de batería', 'Ubicación GPS en tiempo real', 'Botón SOS desde la app', 'Historial de conexiones'],
      imageUrl: '',
      imageAlt: 'App Sensu — pantalla de seguimiento',
    },
    {
      slug: 'app-geo',
      title: 'Geocercas inteligentes',
      body: 'Crea zonas seguras personalizadas en segundos. Recibe alertas automáticas cuando tu ser querido sale o entra a las áreas delimitadas.',
      bullets: ['Define nombre, radio y tipo de alerta', 'Alertas de salida, entrada o ambos', 'Configuración rápida e intuitiva'],
      imageUrl: '',
      imageAlt: 'App Sensu — geocercas inteligentes',
    },
    {
      slug: 'app-manage',
      title: 'Administra dispositivos y ajustes',
      body: 'Configura geocercas, alertas de batería y ajustes de seguridad. Sincroniza dispositivos y personaliza cada detalle de la protección.',
      bullets: ['Sincroniza múltiples dispositivos', 'Configura alertas de batería baja', 'Busca y localiza el dispositivo con sonido'],
      imageUrl: '',
      imageAlt: 'App Sensu — administración de dispositivos',
    },
    {
      slug: 'app-alerts',
      title: 'Alertas instantáneas',
      body: 'Recibe notificaciones en tiempo real de SOS, geocercas, batería baja y más. Mantente informado de todo lo que sucede con el dispositivo.',
      bullets: ['Alertas de SOS, geocercas y batería', 'Historial completo de eventos', 'Notificaciones push en tiempo real'],
      imageUrl: '',
      imageAlt: 'App Sensu — alertas instantáneas',
    },
  ];

  const pullQuote = t(
    'pull-quote',
    'No dependes de que alguien vea el mensaje. No dependes de que alguien esté cerca. Dependes de un sistema diseñado para responder.',
  );

  const deviceImage = pickImage(overrides, 'como-funciona-device-image', {
    url: '',
    alt: 'Dispositivo Angela',
  });

  return (
    <main data-testid="como-funciona-page" className="flex flex-1 flex-col">
      {/* HERO COPY — opens the page directly (video removed 2026-06-06). */}
      <section
        data-testid="como-funciona-hero"
        className="relative w-full px-6 pt-20 pb-12 sm:pt-24 sm:pb-16"
      >
        {isAdmin && (
          <CardEditPencil
            slugBase="como-funciona-hero"
            modalTitle="Editar encabezado de Cómo funciona"
            fields={[
              { key: 'eyebrow', label: 'Eyebrow', type: 'text', initial: heroEyebrow, slug: 'como-funciona-hero-eyebrow' },
              { key: 'title', label: 'Título', type: 'multiline', initial: heroTitle, slug: 'como-funciona-hero-title' },
              { key: 'lead', label: 'Párrafo inicial', type: 'multiline', initial: heroLead, slug: 'como-funciona-hero-lead' },
            ]}
            className="absolute right-6 top-6 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-sensu-600 shadow-sm ring-1 ring-inset ring-zinc-200 hover:opacity-100 cursor-pointer"
          />
        )}
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs uppercase tracking-[0.18em] text-sensu-600 animate-fade-up">
            {heroEyebrow}
          </p>
          <h1 className="mt-3 text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-zinc-900 animate-fade-up [animation-delay:80ms] whitespace-pre-wrap">
            {heroTitle}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base sm:text-lg leading-relaxed text-zinc-600 animate-fade-up [animation-delay:160ms] whitespace-pre-wrap">
            {heroLead}
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3 animate-fade-up [animation-delay:240ms]">
            <Link
              href="/checkout"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-sensu-500 px-7 text-sm font-medium tracking-tight text-white transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
            >
              Contratar ahora
              <LuArrowRight aria-hidden className="h-4 w-4" />
            </Link>
            <Link
              href="#dispositivo"
              className="inline-flex h-12 items-center rounded-full bg-white px-6 text-sm font-medium tracking-tight text-zinc-700 ring-1 ring-zinc-200 transition-colors hover:bg-zinc-50"
            >
              Conoce el dispositivo
            </Link>
          </div>
        </div>
      </section>

      {/* PASO A PASO */}
      <section data-testid="como-funciona-steps" className="w-full px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <p className="text-center text-xs uppercase tracking-[0.18em] text-zinc-500">
            Paso a paso
          </p>
          <h2 className="mt-3 text-center text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900">
            Así funciona Angela
          </h2>
          <ol className="mt-12 grid gap-10 text-center sm:grid-cols-2 lg:grid-cols-4 sm:gap-6">
            {steps.map((s, i) => {
              const title = t(`${s.slug}-title`, s.title);
              const body = t(`${s.slug}-body`, s.body);
              return (
                <li
                  key={s.slug}
                  className="relative flex flex-col items-center animate-fade-up"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  {isAdmin && (
                    <CardEditPencil
                      slugBase={`como-funciona-${s.slug}`}
                      modalTitle={`Editar paso ${i + 1}`}
                      fields={[
                        { key: 'title', label: 'Título', type: 'text', initial: title, slug: `como-funciona-${s.slug}-title` },
                        { key: 'body', label: 'Cuerpo', type: 'multiline', initial: body, slug: `como-funciona-${s.slug}-body` },
                      ]}
                    />
                  )}
                  <span className={`flex h-14 w-14 items-center justify-center rounded-full text-xl font-semibold ring-1 ${s.circle}`}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <p className="mt-5 text-base font-semibold tracking-tight text-zinc-900">
                    {title}
                  </p>
                  <p className="mt-2 max-w-xs text-sm leading-relaxed text-zinc-600 whitespace-pre-wrap">
                    {body}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* EL DISPOSITIVO */}
      <section id="dispositivo" data-testid="como-funciona-device" className="w-full px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <p className="text-center text-xs uppercase tracking-[0.18em] text-zinc-500">
            El dispositivo
          </p>
          <h2 className="mt-3 text-center text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900">
            Tecnología que protege
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm sm:text-base text-zinc-600">
            Angela es un dispositivo portátil, discreto y resistente, diseñado para brindarte seguridad sin comprometer tu independencia.
          </p>
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {deviceFeatures.map((f, i) => {
              const Icon = f.icon;
              const title = t(`${f.slug}-title`, f.title);
              const body = t(`${f.slug}-body`, f.body);
              return (
                <li key={f.slug} className="card-surface relative rounded-3xl p-6 animate-rise" style={{ animationDelay: `${i * 50}ms` }}>
                  {isAdmin && (
                    <CardEditPencil
                      slugBase={`como-funciona-${f.slug}`}
                      modalTitle="Editar característica"
                      fields={[
                        { key: 'title', label: 'Título', type: 'text', initial: title, slug: `como-funciona-${f.slug}-title` },
                        { key: 'body', label: 'Cuerpo', type: 'multiline', initial: body, slug: `como-funciona-${f.slug}-body` },
                      ]}
                    />
                  )}
                  <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-50 text-sensu-500">
                    <Icon className="h-5 w-5" />
                  </span>
                  <p className="mt-4 text-base font-semibold tracking-tight text-zinc-900">{title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600 whitespace-pre-wrap">{body}</p>
                </li>
              );
            })}
          </ul>
          <blockquote className="mx-auto mt-14 max-w-3xl text-center text-xl sm:text-2xl font-medium leading-snug text-zinc-900 italic">
            {isAdmin && (
              <CardEditPencil
                slugBase="como-funciona-pull-quote"
                modalTitle="Editar pull-quote"
                fields={[{ key: 'text', label: 'Cita', type: 'multiline', initial: pullQuote, slug: 'como-funciona-pull-quote' }]}
              />
            )}
            "{pullQuote}"
          </blockquote>
          {/* DEVICE IMAGE — Juan 2026-06-06: picture box below the
              device-feature grid + pull quote. Constrained to max-w-md
              so the angela-device shot does not dominate the section
              (Juan: "the image size below the section is very large").
              Swappable via inline CMS. */}
          <div className="relative mx-auto mt-14 w-full max-w-md overflow-hidden rounded-3xl bg-white">
            {isAdmin && (
              <CardEditPencil
                slugBase="como-funciona-device-image"
                modalTitle="Editar imagen del dispositivo"
                fields={[
                  {
                    key: 'image',
                    label: 'Imagen',
                    type: 'image',
                    initial: deviceImage.url,
                    slug: 'como-funciona-device-image',
                  },
                ]}
              />
            )}
            <img
              src={deviceImage.url}
              alt={deviceImage.alt}
              loading="lazy"
              className="block h-auto w-full [mask-image:linear-gradient(to_bottom,black_72%,transparent_100%)]"
            />
          </div>
        </div>
      </section>

      {/* APP MÓVIL */}
      <section data-testid="como-funciona-app" className="w-full px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <p className="text-center text-xs uppercase tracking-[0.18em] text-zinc-500">App móvil</p>
          <h2 className="mt-3 text-center text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900">
            Control total desde tu celular
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm sm:text-base text-zinc-600">
            La app de Sensu te permite monitorear, configurar y recibir alertas del dispositivo Angela en tiempo real.
          </p>
          <div className="mt-12 space-y-12">
            {appFeatures.map((a, i) => {
              const title = t(`${a.slug}-title`, a.title);
              const body = t(`${a.slug}-body`, a.body);
              const imageSlug = `como-funciona-${a.slug}-image`;
              const image = pickImage(overrides, imageSlug, {
                url: a.imageUrl,
                alt: a.imageAlt,
              });
              return (
                <div key={a.slug} className="relative grid items-center gap-6 sm:grid-cols-[1fr_2fr] animate-fade-up" style={{ animationDelay: `${i * 80}ms` }}>
                  {isAdmin && (
                    <CardEditPencil
                      slugBase={`como-funciona-${a.slug}`}
                      modalTitle="Editar bloque de app"
                      fields={[
                        { key: 'title', label: 'Título', type: 'text', initial: title, slug: `como-funciona-${a.slug}-title` },
                        { key: 'body', label: 'Cuerpo', type: 'multiline', initial: body, slug: `como-funciona-${a.slug}-body` },
                      ]}
                    />
                  )}
                  {/* Left column — picture box only. Title moved to the
                      right column as the text header (Juan 2026-06-06). */}
                  <div className="relative mx-auto aspect-square w-full max-w-[260px] overflow-hidden rounded-2xl bg-zinc-50 ring-1 ring-zinc-100">
                    {isAdmin && (
                      <CardEditPencil
                        slugBase={imageSlug}
                        modalTitle={`Editar imagen — ${title}`}
                        fields={[
                          {
                            key: 'image',
                            label: 'Imagen',
                            type: 'image',
                            initial: image.url,
                            slug: imageSlug,
                          },
                        ]}
                      />
                    )}
                    <img
                      src={image.url}
                      alt={image.alt}
                      loading="lazy"
                      className="block h-full w-full object-cover object-top"
                    />
                  </div>
                  {/* Right column — title as header, then body + bullets. */}
                  <div>
                    <h3 className="text-2xl font-semibold tracking-tight text-zinc-900">{title}</h3>
                    <p className="mt-3 text-base leading-relaxed text-zinc-600">{body}</p>
                    <ul className="mt-4 space-y-1.5 text-sm text-zinc-700">
                      {a.bullets.map((b) => (
                        <li key={b} className="flex items-start gap-2">
                          <LuBellRing aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sensu-500" />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="w-full px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900">
            ¿Listo para vivir con más tranquilidad?
          </h2>
          <p className="mt-3 text-base sm:text-lg text-zinc-600">
            Conoce nuestros planes y elige el que mejor se adapte a tus necesidades. Protección inteligente para ti y los que más quieres.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/planes"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-sensu-500 px-7 text-sm font-medium tracking-tight text-white transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
            >
              Ver planes
              <LuArrowRight aria-hidden className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
