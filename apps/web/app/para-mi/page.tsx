import type { Metadata } from 'next';
import { AudiencePage } from '@/components/audience-page';

const OG_IMAGE =
  'https://res.cloudinary.com/dcfjvxt5h/video/upload/c_fill,g_auto,w_1200,h_630,so_0,f_jpg,q_auto/v1780582705/sensu/landing/para-mi-promo.jpg';

export const metadata: Metadata = {
  title: 'Sensu para ti — Protección personal 24/7',
  description:
    'A veces es un susto, un accidente menor, un problema en el camino o simplemente necesitar ayuda inmediata. Sensu es protección personal conectada a un centro de asistencia profesional.',
  alternates: { canonical: '/para-mi' },
  openGraph: {
    title: 'Sensu para ti — Protección personal 24/7',
    description:
      'Protección personal conectada a un centro de asistencia profesional cuando un susto, un accidente o un problema en el camino lo necesita.',
    url: '/para-mi',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Sensu para ti' }],
  },
  twitter: { card: 'summary_large_image', images: [OG_IMAGE] },
};

export const dynamic = 'force-dynamic';

export default async function ParaMiPage(): Promise<React.ReactElement> {
  return (
    <AudiencePage
      slug="para-mi"
      defaults={{
        eyebrow: 'Para ti y para quien más quieres',
        title: 'Protección personal con respaldo humano 24/7.',
        lead: 'No siempre se trata de una emergencia grave. A veces es un susto, un accidente menor, un problema en el camino o simplemente necesitar ayuda inmediata. Sensu es protección personal conectada a un centro de asistencia profesional que actúa cuando tú lo necesitas.',
        features: [
          'Recibe y atiende alertas SOS en segundos.',
          'Accede a tu ubicación GPS en tiempo real.',
          'Se comunica contigo directamente desde el dispositivo.',
          'Notifica a tus contactos de emergencia.',
          'Coordina envío de ambulancia o servicios médicos.',
          'Activa asistencias médicas, viales o de hogar según la situación.',
        ],
        closing:
          'Porque protegerse no es vivir con miedo. Es vivir sabiendo que, si algo pasa, no estás solo.',
        videoUrl:
          'https://res.cloudinary.com/dcfjvxt5h/video/upload/v1780582705/sensu/landing/para-mi-promo.mov',
      }}
    />
  );
}
