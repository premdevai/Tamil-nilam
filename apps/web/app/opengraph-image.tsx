import { ImageResponse } from 'next/og';

export const alt =
  'NILAM — verified Tamil Nadu industrial land and scheme guidance';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: '#f4f0e6',
        color: '#1f211d',
        padding: '68px 76px',
        fontFamily: 'sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 30,
          fontWeight: 700,
        }}
      >
        <span>NILAM</span>
        <span style={{ color: '#7a6a12', fontSize: 22 }}>
          TAMIL NADU · VERIFIED AT SOURCE
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            display: 'flex',
            maxWidth: 980,
            fontSize: 78,
            fontWeight: 700,
            letterSpacing: -4,
            lineHeight: 1.02,
          }}
        >
          Find the land. Defend the support.
        </div>
        <div
          style={{
            display: 'flex',
            maxWidth: 830,
            marginTop: 30,
            color: '#626258',
            fontSize: 28,
          }}
        >
          Cited industrial land, versioned scheme matching and bilingual
          application guidance.
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          borderTop: '2px solid #cbc5b5',
          paddingTop: 22,
          fontSize: 22,
          color: '#626258',
        }}
      >
        Pending programmes stay visible—but never become calculated benefits.
      </div>
    </div>,
    size,
  );
}
