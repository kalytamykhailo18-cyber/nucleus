'use client';

import { useEffect } from 'react';

// Global broken-image guard. Bound once in the root layout. On any
// <img> load failure anywhere on the page, hide the element via
// visibility:hidden so the broken-icon eyesore never reaches the user
// while preserving the layout slot (halos, gradients, surrounding copy
// stay where they are). Fires on the document in capture phase
// because `error` does not bubble.
//
// Background: 2026-06-26 Juan reported broken images on /; root cause
// was the third-party host (Cloudinary cloud `dcfjvxt5h`) returning
// 401 `cloud_name is disabled` for every asset. The marketing surface
// references 30+ of these URLs. This guard turns that class of
// failure into a silent visual no-op until the assets are rehosted.
export function BrokenImageHider() {
  useEffect(() => {
    const handle = (e: Event): void => {
      const target = e.target as Element | null;
      if (target && target.tagName === 'IMG') {
        (target as HTMLImageElement).style.visibility = 'hidden';
      }
    };
    document.addEventListener('error', handle, true);
    return () => document.removeEventListener('error', handle, true);
  }, []);
  return null;
}
