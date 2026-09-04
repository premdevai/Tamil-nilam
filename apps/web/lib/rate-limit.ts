export type RateLimitDecision =
  { ok: true } | { ok: false; retryAfterSeconds: number };

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function rateLimitClass(pathname: string): string {
  if (pathname.startsWith('/api/auth')) return 'auth';
  if (pathname.startsWith('/api/payments')) return 'payments';
  if (pathname.startsWith('/api/account')) return 'account';
  if (pathname.startsWith('/api/admin')) return 'admin';
  if (pathname.startsWith('/api/e2e')) return 'e2e';
  if (pathname.startsWith('/api/')) return 'api';
  return 'page';
}

export function rateLimitBudget(limitClass: string): {
  limit: number;
  windowMs: number;
} {
  if (limitClass === 'auth') return { limit: 10, windowMs: 60_000 };
  if (limitClass === 'payments') return { limit: 20, windowMs: 60_000 };
  if (limitClass === 'account') return { limit: 30, windowMs: 60_000 };
  if (limitClass === 'admin') return { limit: 40, windowMs: 60_000 };
  if (limitClass === 'e2e') return { limit: 20, windowMs: 60_000 };
  if (limitClass === 'api') return { limit: 60, windowMs: 60_000 };
  return { limit: 240, windowMs: 60_000 };
}

export function consumeRateLimit(
  key: string,
  now = Date.now(),
  store: Map<string, Bucket> = buckets,
): RateLimitDecision {
  const limitClass = key.split(':', 1)[0] ?? 'api';
  const budget = rateLimitBudget(limitClass);
  const current = store.get(key);
  if (current === undefined || current.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + budget.windowMs });
    return { ok: true };
  }
  if (current.count >= budget.limit) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }
  current.count += 1;
  return { ok: true };
}

export function clientKey(pathname: string, ip: string): string {
  return `${rateLimitClass(pathname)}:${pathname}:${ip}`;
}

export function resetRateLimitStore(
  store: Map<string, Bucket> = buckets,
): void {
  store.clear();
}
