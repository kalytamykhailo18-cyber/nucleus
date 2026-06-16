import type { Metadata } from 'next';
import { AudiencePage } from '@/components/audience-page';

const OG_IMAGE =
  'https://res.cloudinary.com/dcfjvxt5h/video/upload/c_fill,g_auto,w_1200,h_630,so_0,f_jpg,q_auto/v1780582709/sensu/landing/trabajadores-promo.jpg';

export const metadata: Metadata = {
  title: 'Sensu para empresas — Protege a tu equipo',
  description:
    'Las emergencias laborales no solo afectan a la persona. Impactan operaciones, reputación y responsabilidad legal. Tercera tu centro de emergencias con Sensu.',
  alternates: { canonical: '/trabajadores' },
  openGraph: {
    title: 'Sensu para empresas — Protege a tu equipo',
    description:
      'Tercera tu centro de emergencias con Sensu — un equipo humano 24/7 al alcance de cada trabajador.',
    url: '/trabajadores',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'Sensu para empresas' }],
  },
  twitter: { card: 'summary_large_image', images: [OG_IMAGE] },
};

export const dynamic = 'force-dynamic';

export default async function TrabajadoresPage(): Promise<React.ReactElement> {
  return (
    <AudiencePage
      slug="trabajadores"
      defaults={{
        eyebrow: 'Para tus trabajadores',
        title: 'Protege a tu equipo. Reduce tu riesgo. Actúa más rápido.',
        lead: 'Las emergencias laborales no solo afectan a la persona. Impactan operaciones, reputación y responsabilidad legal. Sensu permite que tu empresa tenga un sistema profesional de respuesta inmediata sin tener que construirlo desde cero.',
        features: [
          'Botón SOS con atención humana inmediata.',
          'Ubicación GPS en tiempo real.',
          'Comunicación directa con el trabajador.',
          'Centro de asistencia profesional 24/7.',
          'Coordinación de ambulancias y servicios médicos.',
          'Activación de asistencias viales o de apoyo según el caso.',
          'Notificación a responsables internos designados.',
        ],
        closing:
          'Porque proteger a tu equipo también es una decisión estratégica.',
        videoUrl:
          'https://res.cloudinary.com/dcfjvxt5h/video/upload/v1780582709/sensu/landing/trabajadores-promo.mp4',
      }}
    />
  );
}
