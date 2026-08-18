import { ImageResponse } from 'next/og';

/**
 * On-brand marketing illustration generator. Each slug renders a
 * tinted-gradient panel with a large glyph + a Sensu wordmark, sized
 * for the home-page card grid (4:3) or the SOS panel (16:9).
 *
 * Why this exists: the Cloudinary cloud that hosted the original
 * marketing photos was disabled 2026-06-26 and a handful of cards
 * (Call Center, Asistencias integrales, sos-device) describe service
 * realities, not app surfaces — so there's nothing in the Nucleus
 * product to screenshot. Until Juan supplies real brand photography,
 * we render a clean Apple-style brand panel here. Anything Juan
 * uploads via the inline CMS pencil overrides this on a per-slug
 * basis.
 *
 * Glyphs are rendered as inline SVG paths (the same Lucide paths the
 * page uses through react-icons) so the runtime doesn't need to
 * resolve an external font for icon glyphs.
 */
export const dynamic = 'force-static';
export const revalidate = 86400;

interface Spec {
  glyph:
    | 'headphones'
    | 'stethoscope'
    | 'radio'
    | 'smartphone'
    | 'activity'
    | 'shield'
    | 'users'
    | 'heart';
  bgFrom: string;
  bgTo: string;
  glyphColor: string;
  eyebrow: string;
  title: string;
  width: number;
  height: number;
}

const SPECS: Record<string, Spec> = {
  'what-is-card-2-image': {
    glyph: 'headphones',
    bgFrom: '#eff6ff',
    bgTo: '#dbeafe',
    glyphColor: '#0284c7',
    eyebrow: 'CALL CENTER 24/7',
    title: 'Operadores siempre listos',
    width: 1600,
    height: 1200,
  },
  'what-is-card-5-image': {
    glyph: 'stethoscope',
    bgFrom: '#ecfdf5',
    bgTo: '#d1fae5',
    glyphColor: '#059669',
    eyebrow: 'ASISTENCIAS INTEGRALES',
    title: 'Médica · psicológica · vial',
    width: 1600,
    height: 1200,
  },
  'sos-device-image': {
    glyph: 'radio',
    bgFrom: '#fff5f5',
    bgTo: '#ffe7e7',
    glyphColor: '#ff5757',
    eyebrow: 'BOTÓN SOS',
    title: 'Un toque, ayuda en camino',
    width: 1600,
    height: 900,
  },

  // Audience landing-page hero banners (2026-06-29). One per /<audience>
  // route; rendered when the audience-page component has no video URL
  // configured. Sized 1920×1080 because the consumer is a full-screen
  // <img class="h-screen w-full object-cover">, so the banner needs to
  // tolerate object-cover cropping on a 16:9 design.
  'audience-ninos-hero': {
    glyph: 'users',
    bgFrom: '#eff6ff',
    bgTo: '#bfdbfe',
    glyphColor: '#0284c7',
    eyebrow: 'PARA NIÑOS',
    title: 'Libertad con respaldo real',
    width: 1920,
    height: 1080,
  },
  'audience-mujeres-hero': {
    glyph: 'shield',
    bgFrom: '#fff1f2',
    bgTo: '#fecdd3',
    glyphColor: '#e11d48',
    eyebrow: 'PARA MUJERES',
    title: 'Camina con quien te cuida',
    width: 1920,
    height: 1080,
  },
  'audience-adultos-mayores-hero': {
    glyph: 'heart',
    bgFrom: '#ecfdf5',
    bgTo: '#a7f3d0',
    glyphColor: '#059669',
    eyebrow: 'PARA ADULTOS MAYORES',
    title: 'Independencia con compañía',
    width: 1920,
    height: 1080,
  },
  'audience-para-mi-hero': {
    glyph: 'radio',
    bgFrom: '#fff5f5',
    bgTo: '#ffc8c8',
    glyphColor: '#ee3a3a',
    eyebrow: 'PARA MÍ',
    title: 'Un botón, siempre conmigo',
    width: 1920,
    height: 1080,
  },
  'audience-trabajadores-hero': {
    glyph: 'shield',
    bgFrom: '#fffbeb',
    bgTo: '#fde68a',
    glyphColor: '#d97706',
    eyebrow: 'PARA TRABAJADORES',
    title: 'Seguridad en cada turno',
    width: 1920,
    height: 1080,
  },
  'audience-especializado-hero': {
    glyph: 'stethoscope',
    bgFrom: '#f5f3ff',
    bgTo: '#ddd6fe',
    glyphColor: '#7c3aed',
    eyebrow: 'ATENCIÓN ESPECIALIZADA',
    title: 'Equipo médico siempre cerca',
    width: 1920,
    height: 1080,
  },
};

const GLYPH_PATHS: Record<Spec['glyph'], string> = {
  // Lucide path data, viewBox 0 0 24 24, stroke=currentColor 1.5
  headphones: 'M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H4a1 1 0 0 1-1-1v-6a9 9 0 0 1 18 0v6a1 1 0 0 1-1 1h-2a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3',
  stethoscope: 'M11 2v2 M5 2v2 M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1 M8 15a6 6 0 0 0 12 0v-3 M11 11a1 1 0 1 0 2 0 1 1 0 1 0-2 0 M18 12a2 2 0 1 0 4 0 2 2 0 1 0-4 0',
  radio: 'M4.9 19.1A10 10 0 0 1 4.9 4.9 M7.8 16.2a6 6 0 0 1 0-8.4 M12 12h.01 M16.2 7.8a6 6 0 0 1 0 8.4 M19.1 4.9a10 10 0 0 1 0 14.2',
  smartphone: 'M5 4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2zM12 18h.01',
  activity: 'M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.5.5 0 0 1-.95 0L9.24 2.18a.5.5 0 0 0-.95 0L5.93 10.54A2 2 0 0 1 4 12H2',
  shield: 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  heart: 'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z',
};

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await ctx.params;
  const spec = SPECS[slug];
  if (!spec) {
    return new Response('Unknown illustration slug', { status: 404 });
  }

  const glyph = GLYPH_PATHS[spec.glyph];

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: `linear-gradient(140deg, ${spec.bgFrom} 0%, ${spec.bgTo} 100%)`,
          padding: '88px 96px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            fontSize: 30,
            fontWeight: 600,
            letterSpacing: 6,
            color: '#52525b',
          }}
        >
          <div
            style={{
              display: 'flex',
              width: 14,
              height: 14,
              borderRadius: 7,
              background: '#ff5757',
            }}
          />
          <div style={{ display: 'flex' }}>SENSU</div>
        </div>

        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            width={spec.height * 0.42}
            height={spec.height * 0.42}
            viewBox="0 0 24 24"
            fill="none"
            stroke={spec.glyphColor}
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d={glyph} />
          </svg>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            style={{
              display: 'flex',
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: 4,
              color: '#71717a',
            }}
          >
            {spec.eyebrow}
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 60,
              fontWeight: 700,
              letterSpacing: -1,
              color: '#18181b',
              lineHeight: 1.1,
            }}
          >
            {spec.title}
          </div>
        </div>
      </div>
    ),
    { width: spec.width, height: spec.height },
  );
}
