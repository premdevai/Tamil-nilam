export const SECURITY_HEADERS: ReadonlyArray<readonly [string, string]> = [
  ['referrer-policy', 'strict-origin-when-cross-origin'],
  ['x-content-type-options', 'nosniff'],
  ['x-frame-options', 'DENY'],
  ['x-dns-prefetch-control', 'off'],
  ['permissions-policy', 'camera=(), microphone=(), geolocation=()'],
  [
    'content-security-policy',
    [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "img-src 'self' data: blob: https://tile.openstreetmap.org https://basemaps.cartocdn.com https://*.basemaps.cartocdn.com",
      "style-src 'self' 'unsafe-inline'",
      process.env.NODE_ENV === 'production'
        ? "script-src 'self' 'unsafe-inline'"
        : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      // MapLibre GL renders tiles and geometry on a web worker it creates from
      // a blob URL. Without this it falls back to script-src and is blocked,
      // and the plot plan silently fails to draw.
      "worker-src 'self' blob:",
      // Carto supplies the mapcn basemap tiles and its style/sprite/glyph JSON.
      "connect-src 'self' https://tile.openstreetmap.org https://basemaps.cartocdn.com https://*.basemaps.cartocdn.com",
      "font-src 'self' data:",
    ].join('; '),
  ],
];

export function applySecurityHeaders(headers: Headers): void {
  for (const [name, value] of SECURITY_HEADERS) {
    headers.set(name, value);
  }
}
