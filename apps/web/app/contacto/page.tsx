import { LuMessageCircle } from 'react-icons/lu';
import { SectionLabel } from '@/components/section-label';
import { ContactForm } from './contact-form';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Sensu — Contacto',
  description:
    'Déjanos tus datos y un miembro del equipo de ventas de Sensu te contacta para hablar de la mejor opción para tu familiar.',
};

export default function ContactoPage(): React.ReactElement {
  return (
    <main
      data-testid="contacto-page"
      className="flex flex-1 flex-col items-center px-6 pt-12 pb-12"
    >
      <div className="w-full max-w-xl">
        <SectionLabel icon={LuMessageCircle} tone="sensu">
          Contacto
        </SectionLabel>
        <h1 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900">
          Hablemos de tu familiar.
        </h1>
        <p className="mt-3 text-base text-zinc-500">
          Déjanos tu nombre, tu email y un teléfono donde podamos
          alcanzarte. Un miembro del equipo de ventas te llama durante
          el siguiente día hábil para entender qué necesitas y proponerte
          la mejor opción.
        </p>

        <div className="card-surface mt-8 rounded-3xl p-6 sm:p-8">
          <ContactForm />
        </div>
      </div>
    </main>
  );
}
