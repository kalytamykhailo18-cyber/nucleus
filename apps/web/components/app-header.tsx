import Link from 'next/link';
import {
  LuActivity,
  LuArrowRight,
  LuClipboardList,
  LuGitCompareArrows,
  LuLayoutDashboard,
  LuLifeBuoy,
  LuLogOut,
  LuMap,
  LuMapPin,
  LuShield,
  LuTriangleAlert,
  LuRadio,
  LuTruck,
  LuUser,
  LuUsers,
  LuBuilding2,
  LuMessageCircle,
  LuChartLine,
} from 'react-icons/lu';
import { auth } from '@/auth';
import { getLatestSubscriptionState } from '@/lib/subscription-state';
import { prisma } from '@/lib/db';
import { Avatar } from './avatar';
import { HeaderMenu, type HeaderMenuItem } from './header-menu';
import { MarketingNavTab } from './marketing-nav-tab';
import { MobileNavDrawer, type MobileNavItem } from './mobile-nav-drawer';

/**
 * Global app header — sits above every page.
 *
 * Desktop (`sm+`): brand mark on the left, primary actions and a single
 * dropdown trigger ("Menú") on the right. The dropdown lists every
 * nav item the user has access to plus Cerrar sesión at the bottom for
 * authed users.
 *
 * Mobile (<`sm`): brand mark collapses to its glyph, a hamburger
 * button on the left opens a full-height left drawer carrying the same
 * nav items as a vertical list with sub-section support for /soporte.
 *
 * Server component: calls `auth()` directly so the right shape paints
 * on first render with no hydration flicker between visitor and authed
 * chromes.
 */
export async function AppHeader() {
  const session = await auth();
  const isAuthed = !!session?.user;
  const isAdmin =
    isAuthed &&
    (session.user as { role?: 'USER' | 'ADMIN' }).role === 'ADMIN';
  const userId = isAuthed
    ? (session.user as { id?: string }).id ?? null
    : null;
  const subscriptionState = userId
    ? await getLatestSubscriptionState(userId)
    : null;
  const isPendingPayment = subscriptionState?.status === 'PENDING_PAYMENT';

  // Company-admin lens — a CompanyMembership.role=ADMIN with no global
  // ADMIN role is the HR / Safety lead on a managed fleet (Medtronic,
  // Pemex). Their hub is /company, not /dashboard.
  const isCompanyAdmin =
    isAuthed &&
    !isAdmin &&
    !!userId &&
    !!(await prisma.companyMembership.findFirst({
      where: { userId, role: 'ADMIN' },
      select: { id: true },
    }));

  const userChrome = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: { fullName: true, email: true, profileImageUrl: true },
      })
    : null;
  const firstName = userChrome?.fullName?.split(' ')[0] ?? null;

  // Audience landing pages — mirrors the "Casos" dropdown Lovable used
  // on sensu.com.mx. All six routes ship together; the order matches
  // Lovable's nav.
  const audienceSubItems = [
    { slug: 'adultos-mayores', label: 'Adultos mayores' },
    { slug: 'ninos', label: 'Niños' },
    { slug: 'mujeres', label: 'Mujeres' },
    { slug: 'trabajadores', label: 'Trabajadores' },
    { slug: 'para-mi', label: 'Para mí' },
    { slug: 'especializado', label: 'Especializado' },
  ].map((a) => ({
    href: `/${a.slug}`,
    label: a.label,
    testId: `audience-${a.slug}`,
    iconNode: (
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-sensu-50 text-sensu-700">
        <LuUsers className="h-3 w-3" />
      </span>
    ),
  }));

  // Shared nav blueprint — same data shape for both the desktop
  // dropdown and the mobile left drawer. The mobile variant adds
  // `subItems` to the /soporte row so the drawer can expand sections.
  type Blueprint = HeaderMenuItem & { subItems?: typeof audienceSubItems };
  const blueprint: Blueprint[] = [];
  if (isAuthed) {
    if (isPendingPayment) {
      blueprint.push({
        href: '/checkout',
        label: 'Termina tu pago',
        testId: 'pending-payment',
        group: 'attention',
        iconNode: (
          <LuTriangleAlert aria-hidden className="h-4 w-4 text-amber-600" />
        ),
      });
    }
    if (isCompanyAdmin) {
      blueprint.push({
        href: '/company',
        label: 'Mi empresa',
        testId: 'company',
        iconNode: (
          <LuBuilding2 aria-hidden className="h-4 w-4 text-sky-500" />
        ),
      });
    } else {
      blueprint.push({
        href: '/dashboard',
        label: 'Panel',
        testId: 'dashboard',
        iconNode: (
          <LuLayoutDashboard aria-hidden className="h-4 w-4 text-sky-500" />
        ),
      });
    }
    blueprint.push(
      {
        href: '/geofences',
        label: 'Geocercas',
        testId: 'geofences',
        iconNode: <LuMapPin aria-hidden className="h-4 w-4 text-emerald-500" />,
      },
      {
        href: '/profile',
        label: 'Perfil',
        testId: 'profile',
        iconNode: <LuUser aria-hidden className="h-4 w-4 text-violet-500" />,
      },
      {
        href: '/como-funciona',
        label: '¿Cómo funciona?',
        testId: 'como-funciona',
        iconNode: <LuActivity aria-hidden className="h-4 w-4 text-sky-500" />,
      },
      {
        href: '/planes',
        label: 'Planes',
        testId: 'planes',
        iconNode: <LuClipboardList aria-hidden className="h-4 w-4 text-emerald-500" />,
      },
      {
        href: '/adultos-mayores',
        label: 'Casos',
        testId: 'audiences',
        iconNode: <LuUsers aria-hidden className="h-4 w-4 text-amber-500" />,
        subItems: audienceSubItems,
      },
      {
        href: '/soporte',
        label: 'Ayuda',
        testId: 'soporte',
        iconNode: (
          <LuLifeBuoy aria-hidden className="h-4 w-4 text-sensu-500" />
        ),
      },
    );
    if (isAdmin) {
      blueprint.push(
        {
          href: '/admin/registrations',
          label: 'Registros',
          testId: 'admin-registrations',
          group: 'admin',
          iconNode: (
            <LuClipboardList aria-hidden className="h-4 w-4 text-amber-500" />
          ),
        },
        {
          href: '/admin/operator',
          label: 'Operador',
          testId: 'admin-operator',
          group: 'admin',
          iconNode: (
            <LuRadio aria-hidden className="h-4 w-4 text-rose-500" />
          ),
        },
        {
          href: '/admin/dispatch',
          label: 'Despacho',
          testId: 'admin-dispatch',
          group: 'admin',
          iconNode: (
            <LuTruck aria-hidden className="h-4 w-4 text-sensu-500" />
          ),
        },
        {
          href: '/admin/fleet',
          label: 'Mapa de la flota',
          testId: 'admin-fleet',
          group: 'admin',
          iconNode: (
            <LuMap aria-hidden className="h-4 w-4 text-emerald-500" />
          ),
        },
        {
          href: '/admin/companies',
          label: 'Empresas',
          testId: 'admin-companies',
          group: 'admin',
          iconNode: (
            <LuBuilding2 aria-hidden className="h-4 w-4 text-sky-500" />
          ),
        },
        {
          href: '/admin/reporting',
          label: 'Reportes',
          testId: 'admin-reporting',
          group: 'admin',
          iconNode: (
            <LuChartLine aria-hidden className="h-4 w-4 text-emerald-500" />
          ),
        },
        {
          href: '/admin/audit',
          label: 'Auditoría',
          testId: 'admin-audit',
          group: 'admin',
          iconNode: (
            <LuClipboardList aria-hidden className="h-4 w-4 text-amber-500" />
          ),
        },
        {
          href: '/admin/parity',
          label: 'Paridad',
          testId: 'admin-parity',
          group: 'admin',
          iconNode: (
            <LuGitCompareArrows aria-hidden className="h-4 w-4 text-indigo-500" />
          ),
        },
      );
      // 2026-05-29 — admin-group "Soporte" entry retired. The shared
      // "Ayuda" item (added above for every authed user) already
      // routes to /soporte where the inline CMS lives, so admins use
      // that one instead of a duplicate admin-tagged tab.
    }
  } else {
    blueprint.push(
      {
        href: '/',
        label: 'Inicio',
        testId: 'home',
        iconNode: <LuShield aria-hidden className="h-4 w-4 text-sensu-500" />,
      },
      {
        href: '/como-funciona',
        label: '¿Cómo funciona?',
        testId: 'como-funciona',
        iconNode: <LuActivity aria-hidden className="h-4 w-4 text-sky-500" />,
      },
      {
        href: '/planes',
        label: 'Planes',
        testId: 'planes',
        iconNode: <LuClipboardList aria-hidden className="h-4 w-4 text-emerald-500" />,
      },
      {
        href: '/adultos-mayores',
        label: 'Casos',
        testId: 'audiences',
        iconNode: <LuUsers aria-hidden className="h-4 w-4 text-amber-500" />,
        subItems: audienceSubItems,
      },
      {
        href: '/soporte',
        label: 'Ayuda',
        testId: 'soporte',
        iconNode: (
          <LuLifeBuoy aria-hidden className="h-4 w-4 text-sensu-500" />
        ),
      },
      {
        href: '/contacto',
        label: 'Contacto',
        testId: 'contacto',
        iconNode: (
          <LuMessageCircle aria-hidden className="h-4 w-4 text-emerald-500" />
        ),
      },
    );
  }

  const desktopItems: HeaderMenuItem[] = blueprint.map((b) => ({
    href: b.href,
    label: b.label,
    testId: b.testId,
    iconNode: b.iconNode,
    group: b.group,
    subItems: b.subItems,
  }));
  // Mobile drawer additionally carries Iniciar sesión / Crear cuenta
  // for visitors, because the desktop CTA pills (`header-cta-*`) are
  // hidden below `sm` and the drawer is the only nav surface left.
  const mobileVisitorAuthExtras: MobileNavItem[] = isAuthed
    ? []
    : [
        {
          href: '/login',
          label: 'Iniciar sesión',
          testId: 'login',
          group: 'admin',
          iconNode: <LuUser aria-hidden className="h-4 w-4 text-zinc-500" />,
        },
        {
          href: '/signup',
          label: 'Crear cuenta',
          testId: 'signup',
          group: 'admin',
          iconNode: (
            <LuArrowRight aria-hidden className="h-4 w-4 text-sensu-500" />
          ),
        },
      ];
  const mobileItems: MobileNavItem[] = [
    ...blueprint.map((b) => ({
      href: b.href,
      label: b.label,
      testId: b.testId,
      iconNode: b.iconNode,
      group: b.group as MobileNavItem['group'],
      subItems: b.subItems,
    })),
    ...mobileVisitorAuthExtras,
  ];

  // Desktop inline nav — the four non-login marketing surfaces Juan
  // wanted promoted out of the burger menu (2026-06-05). Visible from
  // `md` up; below that the existing MobileNavDrawer sidebar still
  // owns navigation. Casos and Ayuda expose their sub-items via a
  // group-hover / focus-within dropdown so keyboard users get the same
  // affordance pointer users do.
  const marketingNav: Array<{
    href: string;
    label: string;
    testId: string;
    icon: React.ReactNode;
    subItems?: Array<{ href: string; label: string; testId: string; iconNode: React.ReactNode }>;
  }> = [
    {
      href: '/como-funciona',
      label: '¿Cómo funciona?',
      testId: 'nav-como-funciona',
      icon: <LuActivity aria-hidden className="h-4 w-4 text-sky-500" />,
    },
    {
      href: '/planes',
      label: 'Planes',
      testId: 'nav-planes',
      icon: <LuClipboardList aria-hidden className="h-4 w-4 text-emerald-500" />,
    },
    {
      href: '/adultos-mayores',
      label: 'Casos',
      testId: 'nav-casos',
      icon: <LuUsers aria-hidden className="h-4 w-4 text-amber-500" />,
      subItems: audienceSubItems,
    },
    {
      href: '/soporte',
      label: 'Ayuda',
      testId: 'nav-ayuda',
      icon: <LuLifeBuoy aria-hidden className="h-4 w-4 text-sensu-500" />,
    },
  ];

  return (
    <header
      data-testid="app-header"
      className="sticky top-0 z-30 w-full border-b border-zinc-200/70 bg-[#f5f5f7]/80 backdrop-blur-xl"
    >
      <nav
        aria-label="navegación principal"
        className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-3 px-6"
      >
        <div className="flex items-center gap-2">
          <MobileNavDrawer items={mobileItems} showLogout={isAuthed} />
          <Link
            // Brand-mark click destination is role-aware:
            //   - admin → `/` (inline landing CMS, per Ustym 2026-05-29)
            //   - company-admin (HR / Safety lead) → `/company`
            //   - family-account → `/dashboard`
            //   - visitor → `/`
            href={
              !isAuthed || isAdmin
                ? '/'
                : isCompanyAdmin
                  ? '/company'
                  : '/dashboard'
            }
            data-testid="header-brand"
            className="flex shrink-0 items-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500 transition-colors hover:text-zinc-700"
          >
            <LuShield aria-hidden className="h-4 w-4 text-sensu-500" />
            <span className="font-semibold text-zinc-700">Sensu</span>
            <span aria-hidden className="hidden text-zinc-300 sm:inline">
              ·
            </span>
            <span className="hidden sm:inline">Nucleus</span>
          </Link>
        </div>

        {/* Inline desktop nav — hidden on mobile (the drawer covers it). */}
        <ul
          data-testid="header-marketing-nav"
          className="hidden items-center gap-1 min-[960px]:flex"
        >
          {marketingNav.map((item) => (
            <MarketingNavTab
              key={item.href}
              href={item.href}
              label={item.label}
              testId={item.testId}
              icon={item.icon}
              subItems={item.subItems}
            />
          ))}
        </ul>

        <div className="flex items-center gap-2">
          {isAuthed ? (
            <>
              {/* Mobile authed pill — the HeaderMenu dropdown is hidden
                  below 960px (the mobile breakpoint Juan set 2026-06-05),
                  so this Link to /profile is the visible user identity
                  on mobile and small tablets. */}
              <Link
                href="/profile"
                data-testid="header-user-mobile"
                className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-1.5 text-sm font-medium tracking-tight text-zinc-700 transition-colors hover:bg-zinc-100/70 hover:text-zinc-900 min-[960px]:hidden"
              >
                <Avatar
                  src={userChrome?.profileImageUrl ?? null}
                  name={userChrome?.fullName ?? null}
                  email={userChrome?.email ?? null}
                  size="sm"
                />
                {firstName ? (
                  <span className="max-w-[10ch] truncate">{firstName}</span>
                ) : null}
              </Link>
              <HeaderMenu
                items={desktopItems}
                showLogout
                triggerContent={
                  <span
                    data-testid="header-menu-user"
                    className="inline-flex items-center gap-2"
                  >
                    <Avatar
                      src={userChrome?.profileImageUrl ?? null}
                      name={userChrome?.fullName ?? null}
                      email={userChrome?.email ?? null}
                      size="sm"
                    />
                    {firstName ? (
                      <span className="max-w-[14ch] truncate">{firstName}</span>
                    ) : null}
                  </span>
                }
              />
            </>
          ) : (
            <>
              <Link
                href="/login"
                data-testid="header-cta-login"
                className="hidden h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-sm font-medium tracking-tight text-zinc-700 transition-colors hover:text-zinc-900 min-[960px]:inline-flex"
              >
                Iniciar sesión
              </Link>
              <Link
                href="/signup"
                data-testid="header-cta-signup"
                className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-sensu-500 px-3.5 text-sm font-medium tracking-tight text-white transition-transform duration-200 ease-[cubic-bezier(.32,.72,0,1)] hover:-translate-y-0.5 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sensu-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f5f5f7]"
              >
                Crear cuenta
                <LuArrowRight aria-hidden className="h-4 w-4" />
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

// Re-exported so the icon stays adjacent to its sole consumer (the inline
// logout used to live here). Keeps tree-shaking clean.
export { LuLogOut };
