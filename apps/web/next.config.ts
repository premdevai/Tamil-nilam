import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';

import type { NextConfig } from 'next';

import { SECURITY_HEADERS } from './lib/security-headers';

// Local dev keeps one `.env` at the monorepo root (see README). Next only
// reads `apps/web/.env*`, so without this `pnpm dev` ran with no
// DATABASE_URL and every signed-in feature failed. Real env always wins.
// NEXT_PUBLIC_SITE_URL there is the Caddy origin (https://localhost); under
// `next dev` it would make the origin check reject http://localhost:3000.
const CONTAINER_ONLY = new Set(['NEXT_PUBLIC_SITE_URL', 'NODE_ENV']);
const rootEnv = path.resolve(process.cwd(), '../../.env');
if (process.env.NODE_ENV !== 'production' && existsSync(rootEnv)) {
  for (const [key, value] of Object.entries(
    parseEnv(readFileSync(rootEnv, 'utf8')),
  )) {
    if (!CONTAINER_ONLY.has(key)) process.env[key] ??= value;
  }
}

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
