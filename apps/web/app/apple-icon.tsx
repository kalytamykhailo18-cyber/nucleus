import { ImageResponse } from 'next/og';

/**
 * 180×180 apple-touch-icon — what iOS shows on the home screen when
 * the user taps Share → Add to Home Screen. Same coral S brand mark
 * as the favicon. Solid background (iOS does not respect transparent
 * PNGs in this slot).
 */
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#ff5757',
          color: '#ffffff',
          fontSize: 120,
          fontWeight: 700,
          letterSpacing: -5,
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
