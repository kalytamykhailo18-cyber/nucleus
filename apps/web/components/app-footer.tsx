import Link from 'next/link';
import { LuShield } from 'react-icons/lu';
import { LivePulse } from './live-pulse';

/**
 * Global app footer — minimal by design.
 *
 * Left: brand wordmark + year. Middle: legal links (Términos, Aviso de
 * Privacidad). Right: live "24/7 activo" pulse — the single most
 * important trust signal Sensu sells.
 */
export function AppFooter() {
  const year = new Date().getFullYear();
  return (
    <footer
      data-testid="app-footer"
      className="mt-auto border-t border-zinc-200/70 bg-[#f5f5f7]"
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-6 py-6 text-xs text-zinc-500 sm:h-14 sm:flex-row sm:items-center sm:justify-between sm:py-0">
        <div className="flex items-center gap-2">
          <LuShield aria-hidden className="h-3.5 w-3.5 text-sensu-500" />
          <span className="font-medium text-zinc-700">Sensu</span>
          <span aria-hidden className="text-zinc-300">
            ·
          </span>
          <span>© {year}</span>
        </div>
        <nav
          aria-label="legal"
          className="flex items-center gap-4 text-xs"
        >
          <Link
            href="/contacto"
            data-testid="footer-link-contacto"
            className="text-zinc-500 transition-colors hover:text-zinc-900"
          >
            Contacto
          </Link>
          <Link
            href="/terms"
            data-testid="footer-link-terms"
            className="text-zinc-500 transition-colors hover:text-zinc-900"
          >
            Términos
          </Link>
          <Link
            href="/privacy"
            data-testid="footer-link-privacy"
            className="text-zinc-500 transition-colors hover:text-zinc-900"
          >
            Aviso de Privacidad
          </Link>
        </nav>
        <LivePulse label="Servicio 24/7 activo" />
      </div>
    </footer>
  );
}
