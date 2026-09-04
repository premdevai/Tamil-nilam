/**
 * Request proxy: rate limiting, origin checks and security headers.
 *
 * Next 16 renamed the `middleware` file convention to `proxy` — same
 * functionality, and the old name logs a deprecation warning that surfaces in
 * the dev overlay as an issue.
 */
import { NextResponse, type NextRequest } from 'next/server';

import { log } from './lib/log';
import { originAllowed } from './lib/origin';
import { clientKey, consumeRateLimit } from './lib/rate-limit';
import { applySecurityHeaders } from './lib/security-headers';

export function proxy(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'local';
  const decision = consumeRateLimit(clientKey(request.nextUrl.pathname, ip));
  if (!decision.ok) {
    log({
      level: 'warn',
      message: 'rate_limited',
      requestId,
      route: request.nextUrl.pathname,
      status: 429,
    });
    const response = NextResponse.json(
      { error: 'rate_limited' },
      { status: 429 },
    );
    response.headers.set('retry-after', String(decision.retryAfterSeconds));
    response.headers.set('x-request-id', requestId);
    applySecurityHeaders(response.headers);
    return response;
  }

  if (
    !originAllowed({
      method: request.method,
      pathname: request.nextUrl.pathname,
      origin: request.headers.get('origin'),
      host: request.headers.get('host'),
      secFetchSite: request.headers.get('sec-fetch-site'),
    })
  ) {
    log({
      level: 'warn',
      message: 'origin_rejected',
      requestId,
      route: request.nextUrl.pathname,
      status: 403,
    });
    const response = NextResponse.json(
      { error: 'origin_rejected' },
      { status: 403 },
    );
    response.headers.set('x-request-id', requestId);
    applySecurityHeaders(response.headers);
    return response;
  }

  const response = NextResponse.next({
    request: { headers: request.headers },
  });
  response.headers.set('x-request-id', requestId);
  applySecurityHeaders(response.headers);
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
