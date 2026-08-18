import type { Metadata } from 'next';
import { AudiencePage } from '@/components/audience-page';

const OG_IMAGE =
  'https://sensu.com.mx/opengraph-image';

export const metadata: Metadata = {
  title: 'Sensu para niños — Libertad con respaldo',
  description:
    'El camino a la escuela, el parque, las actividades extracurriculares. Acompaña a tu hijo a distancia con rastreo GPS y comunicación en tiempo real respaldada por un centro 24/7.',
  alternates: { canonical: '/ninos' },
  openGraph: {
    title: 'Sensu para niños — Libertad con respaldo',
    description:
      'Acompaña a tu hijo a distancia con rastreo GPS y comunicación en tiempo real respaldada por un centro 24/7.',
    url: '/ninos',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Sensu para niños' }],
  },
  twitter: { card: 'summary_large_image', images: [OG_IMAGE] },
};

export const dynamic = 'force-dynamic';

export default async function NinosPage(): Promise<React.ReactElement> {
  return (
    <AudiencePage
      slug="ninos"
      defaults={{
        eyebrow: 'Para niños',
        title: 'Dales libertad sin perder la tranquilidad.',
        lead: 'El camino a la escuela, las actividades extracurriculares, el parque con los amigos. Como padre, quieres que tu hijo crezca con independencia, pero también quieres saber que está seguro. Sensu te permite acompañarlo a distancia con tecnología de rastreo y comunicación en tiempo real, respaldada por un centro de asistencia profesional.',
        features: [
          'Rastreo GPS en tiempo real desde la app.',
          'Alertas automáticas si sale de zonas seguras definidas.',
          'Notificación de paradas inesperadas o desvíos de ruta.',
          'Altavoz bidireccional para comunicarte directamente con tu hijo.',
          'Botón SOS para pedir ayuda con un solo toque.',
          'Centro de asistencia profesional 24/7.',
          'Historial de ubicaciones y actividad diaria.',
          'Alarma audible en el dispositivo para encontrarlo fácilmente.',
          'Notificación a contactos de emergencia.',
        ],
        closing:
          'Porque proteger a tus hijos no es limitarlos. Es darles libertad con un respaldo real detrás.',
        videoUrl:
          '',
      }}
    />
  );
}
