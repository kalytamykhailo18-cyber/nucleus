import { LuMapPin } from 'react-icons/lu';
import { requireFamilySession } from '@/lib/admin';
import { GeofenceEditor } from '@/components/geofence-editor';
import { SectionLabel } from '@/components/section-label';
import { fetchUserDevices } from '@/lib/devices';
import { fetchUserGeofences } from '@/lib/geofences';

export default async function GeofencesPage() {
  const { id: userId } = await requireFamilySession('/geofences');

  const [devices, geofences] = await Promise.all([
    fetchUserDevices(userId),
    fetchUserGeofences(userId),
  ]);

  return (
    <main
      data-testid="geofences-page"
      className="flex flex-1 flex-col items-center px-6 pt-12 pb-12"
    >
      <div className="w-full max-w-3xl">
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-zinc-900 animate-fade-up [animation-delay:80ms]">
          Geocercas
        </h1>
        <p className="mt-2 text-base text-zinc-500 animate-fade-up [animation-delay:160ms]">
          Define las zonas que importan para tu familiar — casa, parque,
          hospital. Recibirás una alerta cuando entre o salga.
        </p>

        {devices.length === 0 ? (
          <div
            data-testid="geofences-no-device"
            className="card-surface mt-10 rounded-3xl px-6 py-10 text-center animate-fade-up [animation-delay:240ms]"
          >
            <LuMapPin aria-hidden className="mx-auto h-6 w-6 text-sensu-500" />
            <p className="mt-3 text-sm font-medium text-zinc-700">
              Necesitas una Angela asignada antes de configurar geocercas.
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              El call center activa el dispositivo a tu nombre cuando lo
              recibes — aparecerá en tu panel y podrás dibujar zonas aquí.
            </p>
          </div>
        ) : (
          <section
            data-testid="geofences-editor"
            className="mt-10 animate-fade-up [animation-delay:240ms]"
          >
            <header className="mb-4">
              <SectionLabel icon={LuMapPin} tone="sky">Zonas configuradas</SectionLabel>
            </header>
            <GeofenceEditor
              initialGeofences={geofences}
              devices={devices.map((d) => ({ deviceId: d.deviceId, label: d.label }))}
            />
          </section>
        )}
      </div>
    </main>
  );
}
