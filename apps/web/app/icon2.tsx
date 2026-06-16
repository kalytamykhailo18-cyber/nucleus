import { ImageResponse } from 'next/og';

/**
 * 512×512 PWA icon — splash screen + Android install adaptive icon.
 * Marked `purpose: "any maskable"` in the manifest so launchers can
 * crop a circle or rounded square without the "S" being cut.
 */
export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon512() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#ff5757',
          color: '#ffffff',
          fontSize: 340,
          fontWeight: 700,
          letterSpacing: -16,
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
