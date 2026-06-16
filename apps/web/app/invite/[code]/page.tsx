import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LuCircleAlert, LuShield, LuUsers } from 'react-icons/lu';
import { auth } from '@/auth';
import { getPublicInvite } from '@/lib/family-invite';
import { SectionLabel } from '@/components/section-label';
import { InviteClaimButton } from './invite-claim-button';

export const dynamic = 'force-dynamic';

export default async function InviteLandingPage({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<React.ReactElement> {
  const { code } = await params;
  const invite = await getPublicInvite(code);
  const session = await auth();
  const signedIn = !!session?.user;

  if (!invite) {
    return (
      <main
        data-testid="invite-page"
        data-invite-state="invalid"
        className="flex flex-1 flex-col items-center px-6 pt-16 pb-12"
      >
        <div className="w-full max-w-md">
          <SectionLabel icon={LuCircleAlert} tone="rose">
            Enlace inválido
          </SectionLabel>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">
            Este enlace ya no funciona
          </h1>
          <p className="mt-3 text-sm text-zinc-600 leading-relaxed">
            El enlace de invitación ya fue usado o expiró. Pídele a tu
            familiar que te envíe uno nuevo desde su perfil en Sensu.
          </p>
          <Link
            href="/"
            data-testid="invite-page-home"
            className="mt-6 inline-flex h-9 items-center gap-1.5 rounded-full bg-zinc-100 px-4 text-sm font-medium tracking-tight text-zinc-700 transition-colors hover:bg-zinc-200 hover:text-zinc-900"
          >
            Volver al inicio
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main
      data-testid="invite-page"
      data-invite-state="valid"
      className="flex flex-1 flex-col items-center px-6 pt-16 pb-12"
    >
      <div className="w-full max-w-md">
        <SectionLabel icon={LuUsers} tone="sensu">
          Invitación a Sensu
        </SectionLabel>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">
          Te invitaron a ver la Angela de{' '}
          <span data-testid="invite-master-name">{invite.masterFirstName}</span>
        </h1>
        <p className="mt-3 text-sm text-zinc-600 leading-relaxed">
          Al aceptar verás el dispositivo{' '}
          <strong data-testid="invite-device-label" className="font-semibold text-zinc-800">
            {invite.deviceLabel}
          </strong>{' '}
          en tu panel, junto con las alertas y la ubicación en vivo.
        </p>

        <div className="mt-8 rounded-3xl bg-sensu-50/60 p-6 ring-1 ring-sensu-100">
          <div className="flex items-center gap-3 text-sm text-sensu-700">
            <LuShield aria-hidden className="h-5 w-5 text-sensu-500" />
            <span className="font-medium">
              {signedIn
                ? 'Listo para aceptar la invitación'
                : 'Inicia sesión o crea una cuenta para aceptar'}
            </span>
          </div>
          <div className="mt-5">
            {signedIn ? (
              <InviteClaimButton code={invite.code} />
            ) : (
              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/signup?next=${encodeURIComponent(
                    `/invite/${invite.code}`,
                  )}${invite.email ? `&email=${encodeURIComponent(invite.email)}` : ''}`}
                  data-testid="invite-signup"
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-sensu-500 px-4 text-sm font-medium tracking-tight text-white transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
                >
                  Crear cuenta
                </Link>
                <Link
                  href={`/login?next=${encodeURIComponent(
                    `/invite/${invite.code}`,
                  )}`}
                  data-testid="invite-login"
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-medium tracking-tight text-zinc-700 ring-1 ring-zinc-200 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
                >
                  Iniciar sesión
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
