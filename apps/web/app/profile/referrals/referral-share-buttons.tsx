'use client';

import { useState } from 'react';
import { LuCheck, LuCopy, LuShare2 } from 'react-icons/lu';

/**
 * Three share affordances for a referral code:
 *   - Copy URL to clipboard (browser API)
 *   - Share via WhatsApp deep link
 *   - Share via the OS share sheet on mobile (Web Share API)
 *
 * Pure client behavior; the parent server component does the URL +
 * code derivation and passes them in as props.
 */
export function ReferralShareButtons({
  code,
  shareUrl,
}: {
  code: string;
  shareUrl: string;
}): React.ReactElement {
  const [copied, setCopied] = useState(false);

  const message = `Te invito a Sensu — monitoreo 24/7 para nuestros familiares. Usa mi código ${code} al registrarte: ${shareUrl}`;

  async function handleCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be blocked (insecure context, permissions);
      // fail quietly — user can still see the URL on the page.
    }
  }

  async function handleNativeShare(): Promise<void> {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({
          title: 'Sensu — monitoreo 24/7 para tu familia',
          text: message,
          url: shareUrl,
        });
      } catch {
        // User cancelled or share failed — silent.
      }
    }
  }

  const supportsNativeShare =
    typeof navigator !== 'undefined' && 'share' in navigator;

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(message)}`;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void handleCopy()}
        data-testid="profile-referrals-copy"
        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-zinc-900 px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
      >
        {copied ? (
          <>
            <LuCheck aria-hidden className="h-4 w-4" />
            Copiado
          </>
        ) : (
          <>
            <LuCopy aria-hidden className="h-4 w-4" />
            Copiar enlace
          </>
        )}
      </button>
      <a
        href={whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="profile-referrals-whatsapp"
        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-emerald-500 px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
      >
        WhatsApp
      </a>
      {supportsNativeShare && (
        <button
          type="button"
          onClick={() => void handleNativeShare()}
          data-testid="profile-referrals-native-share"
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-medium text-zinc-700 ring-1 ring-inset ring-zinc-200 transition-colors hover:bg-zinc-50"
        >
          <LuShare2 aria-hidden className="h-4 w-4" />
          Compartir
        </button>
      )}
    </div>
  );
}
