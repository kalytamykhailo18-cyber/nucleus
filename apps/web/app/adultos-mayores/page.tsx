import type { Metadata } from 'next';
import { AudiencePage } from '@/components/audience-page';

const OG_IMAGE =
  'https://sensu.com.mx/opengraph-image';

export const metadata: Metadata = {
  title: 'Sensu para adultos mayores — Independencia con respaldo',
  description:
    'Una caída, un mareo, una emergencia médica. Sensu conecta a tus seres queridos con un centro de asistencia profesional 24/7 que actúa de inmediato.',
  alternates: { canonical: '/adultos-mayores' },
  openGraph: {
    title: 'Sensu para adultos mayores — Independencia con respaldo',
    description:
      'Una caída, un mareo, una emergencia médica. Sensu conecta a tus seres queridos con un centro de asistencia profesional 24/7 que actúa de inmediato.',
    url: '/adultos-mayores',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Sensu para adultos mayores' }],
  },
  twitter: { card: 'summary_large_image', images: [OG_IMAGE] },
};

export const dynamic = 'force-dynamic';

export default async function AdultosMayoresPage(): Promise<React.ReactElement> {
  return (
    <AudiencePage
      slug="adultos-mayores"
      defaults={{
        eyebrow: 'Para adultos mayores',
        title: 'Independencia con respaldo. Tranquilidad para toda la familia.',
        lead: 'Una caída, un mareo, una emergencia médica en casa o en la calle. Cuando un adulto mayor vive solo o pasa tiempo sin acompañamiento, cada segundo cuenta. Sensu conecta a tus seres queridos con un centro de asistencia profesional que actúa de inmediato, sin depender de que alguien esté cerca.',
        features: [
          'Detección automática de caídas con alerta instantánea.',
          'Botón SOS de emergencia, fácil de usar.',
          'Detector de voz: di "Auxilio" para activar ayuda sin presionar nada.',
          'Centro de asistencia profesional 24/7 que verifica y coordina ayuda.',
          'Ubicación GPS en tiempo real para familiares.',
          'Comunicación directa desde el dispositivo con el centro de atención.',
          'Coordinación de ambulancia, enfermero o servicios médicos.',
          'Notificación inmediata a contactos de emergencia.',
          'Monitoreo de actividad e inactividad inusual.',
        ],
        closing:
          'Porque envejecer con dignidad es vivir con independencia, sabiendo que si algo pasa, la ayuda llega en segundos.',
        videoUrl:
          '',
      }}
    />
  );
}
