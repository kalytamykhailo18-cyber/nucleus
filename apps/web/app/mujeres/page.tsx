import type { Metadata } from 'next';
import { AudiencePage } from '@/components/audience-page';

const OG_IMAGE =
  'https://res.cloudinary.com/dcfjvxt5h/video/upload/c_fill,g_auto,w_1200,h_630,so_0,f_jpg,q_auto/v1780582696/sensu/landing/angela-promo-2.jpg';

export const metadata: Metadata = {
  title: 'Sensu para mujeres — Tú decides a dónde ir',
  description:
    'ANGELA es el primer wearable de protección personal con un equipo humano respondiendo 24/7. Un toque, sin pantalla. Diseñado para mujeres que no piden permiso para vivir su vida.',
  alternates: { canonical: '/mujeres' },
  openGraph: {
    title: 'Sensu para mujeres — Tú decides a dónde ir',
    description:
      'El primer wearable de protección personal con un equipo humano respondiendo 24/7. Un toque, sin pantalla.',
    url: '/mujeres',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Sensu para mujeres' }],
  },
  twitter: { card: 'summary_large_image', images: [OG_IMAGE] },
};

export const dynamic = 'force-dynamic';

export default async function MujeresPage(): Promise<React.ReactElement> {
  return (
    <AudiencePage
      slug="mujeres"
      defaults={{
        eyebrow: 'Nueva generación de protección personal',
        title: 'Tú decides a dónde ir. Nosotros nos encargamos del resto.',
        lead: 'ANGELA es el primer wearable de protección personal con un equipo humano respondiendo 24/7. Lo presionas una vez. En segundos, alguien real está contigo. Diseñado para mujeres que no piden permiso para vivir su vida.',
        features: [
          'Un toque, sin pantalla — sin desbloquear el celular, sin buscar una app.',
          'Tu ubicación en vivo: tu red de confianza y nuestro centro saben exactamente dónde estás.',
          'Personas, no algoritmos — operadores capacitados que te escuchan y deciden contigo.',
          'Tu círculo, avisado al instante con notificación inmediata y ubicación.',
          'Coordinamos lo que necesites: ambulancia, paramédicos, seguridad privada o autoridades.',
          'Hecho para tu rutina — corres, viajas, trabajas, sales. Él va contigo.',
        ],
        closing:
          'No vas a dejar de vivir tu vida. Solo vas a hacerlo con respaldo.',
        // /mujeres on Lovable used a static product image hero
        // (angela-device.png) rather than a video. Defaulting to the
        // angela-promo-2 reel here so the page has a lifestyle motion
        // surface matching the other audience pages — Juan can swap to
        // a dedicated /mujeres video via the inline CMS when one is
        // produced.
        videoUrl:
          'https://res.cloudinary.com/dcfjvxt5h/video/upload/v1780582696/sensu/landing/angela-promo-2.mp4',
      }}
    />
  );
}
