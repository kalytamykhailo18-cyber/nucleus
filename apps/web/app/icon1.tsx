import { ImageResponse } from 'next/og';

/**
 * 192×192 PWA icon. Referenced from `app/manifest.ts` for Android
 * home-screen install. Same coral square + white "S" used in the
 * 32×32 favicon, just at a size large enough for the launcher grid.
 */
export const size = { width: 192, height: 192 };
export const contentType = 'image/png';

export default function Icon192() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#ff5757',
          color: '#ffffff',
          fontSize: 130,
          fontWeight: 700,
          letterSpacing: -6,
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
