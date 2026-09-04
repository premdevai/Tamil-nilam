import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';

import { prepareShareCardEvaluation } from '../../../lib/matcher-surfaces';

export const runtime = 'nodejs';

export function GET(request: NextRequest) {
  const { result } = prepareShareCardEvaluation(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );
  const amount = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 2,
  }).format(result.totalLakhs);

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
        padding: '62px 72px',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', fontSize: 30, fontWeight: 700 }}>
          NILAM
        </div>
        <div
          style={{
            display: 'flex',
            color: '#7a6a12',
            fontSize: 22,
            letterSpacing: 2,
            textTransform: 'uppercase',
          }}
        >
          Cited scheme match
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', color: '#626258', fontSize: 25 }}>
          Directional calculated assistance
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 12,
            fontSize: 86,
            fontWeight: 700,
            letterSpacing: -4,
          }}
        >
          ₹{amount} lakh
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 14,
            marginTop: 28,
          }}
        >
          {result.eligible.slice(0, 4).map((scheme) => (
            <div
              key={scheme.schemeId}
              style={{
                display: 'flex',
                border: '2px solid #cbc5b5',
                padding: '10px 16px',
                fontSize: 22,
              }}
            >
              {scheme.name}
            </div>
          ))}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          borderTop: '2px solid #cbc5b5',
          paddingTop: 20,
          color: '#626258',
          fontSize: 20,
        }}
      >
        <div style={{ display: 'flex' }}>
          Ruleset {result.rulesetVersion} · {result.asOf}
        </div>
        <div style={{ display: 'flex' }}>
          {result.pendingVerification.length} pending records excluded · not a
          sanction
        </div>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
      },
    },
  );
}
