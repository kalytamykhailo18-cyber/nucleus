import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import { Inter } from 'next/font/google';
import './globals.css';
import { AppHeader } from '@/components/app-header';
import { AppFooter } from '@/components/app-footer';
import { PendingPaymentBanner } from '@/components/pending-payment-banner';
import { HideOnPaths } from '@/components/hide-on-paths';
import { BfcacheGuard } from '@/components/bfcache-guard';
import { NavigationProgress } from '@/components/navigation-progress';
import { FloatingWhatsApp } from '@/components/floating-whatsapp';
import { ServiceWorkerRegister } from '@/components/service-worker-register';
import { PwaInstallTutorial } from '@/components/pwa-install-tutorial';
import { ConnectivityToasts } from '@/components/connectivity-toasts';
import { BrokenImageHider } from '@/components/broken-image-hider';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

// Default open-graph image — Angela device shot served via Cloudinary
// with an OG-friendly 1200x630 crop. Per-page metadata overrides this
// with a page-specific image where it makes sense (audience pages use
// their own promo poster).
const OG_DEFAULT_IMAGE =
  'https://sensu.com.mx/opengraph-image';

export const metadata: Metadata = {
  metadataBase: new URL('https://sensu.com.mx'),
  title: {
    default: 'Sensu Angela — Monitoreo 24/7 con respuesta humana',
    template: '%s · Sensu Angela',
  },
  description:
    'Sensu Angela es un sistema de protección personal con botón SOS, GPS y centro de asistencia 24/7 — cuida a quien más quieres dentro y fuera de casa.',
  applicationName: 'Sensu Angela',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    siteName: 'Sensu Angela',
    locale: 'es_MX',
    url: 'https://sensu.com.mx',
    title: 'Sensu Angela — Monitoreo 24/7 con respuesta humana',
    description:
      'Sensu Angela es un sistema de protección personal con botón SOS, GPS y centro de asistencia 24/7.',
    images: [
      {
        url: OG_DEFAULT_IMAGE,
        width: 1200,
        height: 630,
        alt: 'Dispositivo Sensu Angela',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sensu Angela — Monitoreo 24/7 con respuesta humana',
    description:
      'Sensu Angela es un sistema de protección personal con botón SOS, GPS y centro de asistencia 24/7.',
    images: [OG_DEFAULT_IMAGE],
  },
  // PWA tags — make iOS Safari treat "Add to Home Screen" as a real
  // app launch (no Safari chrome, coral status bar, branded title).
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Sensu Angela',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#ff5757',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="font-[family-name:var(--font-display)] antialiased text-zinc-900 bg-[#f5f5f7] selection:bg-sensu-100 selection:text-zinc-900 flex flex-col min-h-screen">
        <BfcacheGuard />
        <BrokenImageHider />
        <ServiceWorkerRegister />
        <ConnectivityToasts />
        <HideOnPaths paths={['/admin', '/checkout']}>
          <PwaInstallTutorial />
        </HideOnPaths>
        <Suspense fallback={null}>
          <NavigationProgress />
        </Suspense>
        {/* Global AppHeader is suppressed on the compact family + operator
            app surfaces (Ustym 2026-08-10 audit gap 2) — those pages own
            their own page-level header so the marketing brand does not
            stack on top of the app brand. */}
        <HideOnPaths paths={['/app']}>
          <AppHeader />
        </HideOnPaths>
        <HideOnPaths
          paths={[
            '/checkout',
            '/login',
            '/signup',
            '/forgot-password',
            '/reset-password',
          ]}
        >
          <PendingPaymentBanner />
        </HideOnPaths>
        <div className="flex-1 flex flex-col">{children}</div>
        {/* Marketing footer (© / Contacto / Términos) is hidden on the
            app surfaces (audit gap 3) — legal-copy footer has no place
            on an emergency-monitoring surface a family opens at 2 AM. */}
        <HideOnPaths paths={['/app']}>
          <AppFooter />
        </HideOnPaths>
        {/* Floating WhatsApp CTA — visible on every public/marketing
            surface, suppressed on auth + app + install routes where it
            would distract from task flows. Audit gap 4: adding /app and
            /instalar so the green circle stops overlapping the map pin
            and the install tutorial on iPhone SE. */}
        <HideOnPaths
          paths={[
            '/checkout',
            '/login',
            '/signup',
            '/forgot-password',
            '/reset-password',
            '/dashboard',
            '/profile',
            '/geofences',
            '/admin',
            '/app',
            '/instalar',
          ]}
        >
          <FloatingWhatsApp />
        </HideOnPaths>
      </body>
    </html>
  );
}
