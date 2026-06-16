import { ImageResponse } from 'next/og';

/**
 * Auto-generated favicon. A coral square with a white shield glyph inside —
 * matches the LuShield brand mark used in the app header. Next.js renders
 * this at build time and serves it at /icon, which the browser uses as
 * the favicon (no public/favicon.ico needed).
 */
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#ff5757',
          color: '#ffffff',
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: -1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        S
      </div>
    ),
    { ...size },
  );
}
