import { describe, expect, it } from 'vitest';

import { safeNextPath } from './safe-next';

describe('safeNextPath', () => {
  it('keeps same-origin paths with their query', () => {
    expect(safeNextPath('/account/dpr?projectCost=5000000')).toBe(
      '/account/dpr?projectCost=5000000',
    );
  });

  it('rejects open redirects', () => {
    for (const value of [
      'https://evil.test',
      '//evil.test',
      '/\\evil.test',
      'account',
      '',
      undefined,
      ['/account'],
    ]) {
      expect(safeNextPath(value)).toBeUndefined();
    }
  });
});
