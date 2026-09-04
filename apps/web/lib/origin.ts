export function allowedOrigins(
  siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
): readonly string[] {
  const url = new URL(siteUrl);
  const origins = new Set<string>([url.origin]);
  const port = url.port === '' ? '' : `:${url.port}`;
  if (url.hostname === 'localhost') {
    origins.add(`${url.protocol}//127.0.0.1${port}`);
  }
  if (url.hostname === '127.0.0.1') {
    origins.add(`${url.protocol}//localhost${port}`);
  }
  return [...origins];
}

export function isSafeMethod(method: string): boolean {
  return method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
}

export function originExemptPath(pathname: string): boolean {
  return (
    pathname.startsWith('/api/auth') ||
    pathname === '/api/payments/webhook' ||
    pathname === '/api/health' ||
    pathname === '/api/health/ready' ||
    pathname === '/api/e2e/session'
  );
}

export function originAllowed(request: {
  method: string;
  pathname: string;
  origin: string | null;
  host: string | null;
  secFetchSite: string | null;
  siteUrl?: string;
}): boolean {
  if (isSafeMethod(request.method) || originExemptPath(request.pathname)) {
    return true;
  }
  const allowed = allowedOrigins(request.siteUrl);
  if (request.origin !== null && allowed.includes(request.origin)) {
    return true;
  }
  if (request.origin === null) {
    if (
      request.secFetchSite === 'same-origin' ||
      request.secFetchSite === 'none'
    ) {
      return true;
    }
    if (request.host !== null) {
      return (
        allowed.some((origin) => origin === `http://${request.host}`) ||
        allowed.some((origin) => origin === `https://${request.host}`)
      );
    }
  }
  return false;
}
