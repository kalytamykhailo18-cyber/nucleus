'use client';

import { usePathname } from 'next/navigation';

/**
 * Suppress child rendering on a list of route prefixes.
 *
 * Used to hide layout-level components (banners, prompts) on routes
 * where they would be redundant or noisy. The children still render
 * server-side; this wrapper just removes them from the DOM client-side
 * on matching paths. Cheap, no middleware-header gymnastics.
 */
export function HideOnPaths({
  paths,
  children,
}: {
  paths: string[];
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? '';
  const hidden = paths.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  if (hidden) return null;
  return <>{children}</>;
}
