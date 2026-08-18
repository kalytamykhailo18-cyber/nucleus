import { ImageResponse } from 'next/og';

/**
 * Auto-generated default Open Graph image. Coral brand panel with the
 * Sensu wordmark + tagline, sized 1200x630 for WhatsApp, Twitter, and
 * Facebook link previews. Replaces the Cloudinary-hosted PNG that died
 * 2026-06-26 when the upstream account was disabled; pages still
 * declare their own metadata.openGraph.images so each surface can
 * override (e.g., a future audience-specific banner).
 */
export const alt = 'Sensu — Monitoreo 24/7 con respuesta humana';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          background:
            'linear-gradient(135deg, #ff5757 0%, #ee3a3a 60%, #c92a2a 100%)',
          color: '#ffffff',
          padding: '88px 96px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div
          style={{
            fontSize: 36,
            fontWeight: 600,
            letterSpacing: 6,
            textTransform: 'uppercase',
            opacity: 0.85,
            marginBottom: 32,
          }}
        >
          SENSU
        </div>
        <div
          style={{
            fontSize: 92,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: -2,
            maxWidth: 960,
          }}
        >
          Siempre hay alguien listo para ayudarte.
        </div>
        <div
          style={{
            marginTop: 40,
            fontSize: 34,
            fontWeight: 500,
            opacity: 0.92,
          }}
        >
          Monitoreo 24/7 con respuesta humana real.
        </div>
      </div>
    ),
    { ...size },
  );
}
