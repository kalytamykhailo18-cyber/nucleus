import type { Metadata } from 'next';
import { AudiencePage } from '@/components/audience-page';

const OG_IMAGE =
  'https://res.cloudinary.com/dcfjvxt5h/video/upload/c_fill,g_auto,w_1200,h_630,so_0,f_jpg,q_auto/v1780582702/sensu/landing/especializado-promo.jpg';

export const metadata: Metadata = {
  title: 'Sensu especializado — Nos adaptamos a ti',
  description:
    'Sensu se adapta a múltiples situaciones donde contar con respuesta inmediata marca la diferencia: epilepsia, deporte, embarazo, ansiedad, recuperación médica.',
  alternates: { canonical: '/especializado' },
  openGraph: {
    title: 'Sensu especializado — Nos adaptamos a ti',
    description:
      'Para epilepsia, deporte, embarazo, ansiedad, recuperación médica — Sensu se adapta a quien necesita respuesta inmediata.',
    url: '/especializado',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Sensu especializado' }],
  },
  twitter: { card: 'summary_large_image', images: [OG_IMAGE] },
};

export const dynamic = 'force-dynamic';

export default async function EspecializadoPage(): Promise<React.ReactElement> {
  return (
    <AudiencePage
      slug="especializado"
      defaults={{
        eyebrow: 'Nos adaptamos a ti',
        title: 'Más formas de vivir con respaldo.',
        lead: 'Sensu ya ayuda a personas en distintos momentos de vulnerabilidad. Gracias a nuestro sistema adaptable —dispositivo inteligente, monitoreo 24/7 y centro de asistencia profesional— podemos ajustarnos a múltiples situaciones donde contar con respuesta inmediata marca la diferencia.',
        features: [
          'Personas con epilepsia u otras condiciones médicas que requieren atención rápida ante una crisis.',
          'Mujeres que quieren sentirse más seguras al salir, viajar o moverse solas.',
          'Personas que practican deporte al aire libre o actividades de riesgo.',
          'Personas que viven solas y quieren respaldo inmediato ante cualquier emergencia.',
          'Pacientes en recuperación médica que necesitan monitoreo adicional.',
          'Personas con ansiedad o ataques de pánico que buscan una red de apoyo inmediata.',
          'Familias que desean supervisión remota en situaciones específicas.',
        ],
        closing:
          'No se trata de un perfil específico. Se trata de cualquier persona que quiera libertad con respaldo.',
        videoUrl:
          'https://res.cloudinary.com/dcfjvxt5h/video/upload/v1780582702/sensu/landing/especializado-promo.mov',
      }}
    />
  );
}
