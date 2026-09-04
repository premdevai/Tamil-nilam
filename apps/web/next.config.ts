import type { NextConfig } from 'next';

import { SECURITY_HEADERS } from './lib/security-headers';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  devIndicators: false,
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  // ponytail: Vercel needs default output for *.nft.json; Docker uses next start
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ['@nilam/db', '@nilam/engine', '@nilam/paid', '@nilam/ui'],
  experimental: {
    optimizePackageImports: ['maplibre-gl'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: SECURITY_HEADERS.map(([key, value]) => ({
          key,
          value,
        })),
      },
    ];
  },
};

export default nextConfig;
