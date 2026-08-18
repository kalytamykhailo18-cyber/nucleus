'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { LuSmartphone } from 'react-icons/lu';

/**
 * Persistent "Instala Sensu en tu teléfono" chip (Ustym 2026-08-10).
 *
 * The `PwaInstallTutorial` bottom-sheet only shows once. Users who
 * dismissed it never see the install path again unless they wait
 * seven days. That silence made most families use `/dashboard` as a
 * bookmarked website and never install, which is what turned every
 * push notification into a coin-flip.
 *
 * This chip sits inline on `/dashboard` so a real user can always
 * find the install path without typing a URL. It links to
 * `/instalar` (the full Spanish walkthrough page with per-platform
 * steps). Suppressed when the app is already running in standalone
 * mode — nothing to install in that case.
 */
export function InstallChip(): React.ReactElement | null {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const navStandalone = (navigator as Navigator & { standalone?: boolean })
      .standalone;
    const isStandalone =
      navStandalone === true ||
      window.matchMedia('(display-mode: standalone)').matches;
    setVisible(!isStandalone);
  }, []);

  if (!visible) return null;
  return (
    <Link
      href="/instalar"
      data-testid="dashboard-install-chip"
      className="inline-flex h-9 items-center gap-1.5 rounded-full bg-sensu-50 px-3 text-xs font-medium text-sensu-700 ring-1 ring-sensu-200 transition-colors hover:bg-sensu-100 cursor-pointer"
    >
      <LuSmartphone aria-hidden className="h-3.5 w-3.5" />
      Instala Sensu en tu teléfono
    </Link>
  );
}
