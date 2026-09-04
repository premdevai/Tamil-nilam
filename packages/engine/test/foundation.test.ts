import { describe, expect, it } from 'vitest';

import { ENGINE_PACKAGE_VERSION } from '../src/index.js';

describe('engine package boundary', () => {
  it('exposes the rule-engine package version', () => {
    expect(ENGINE_PACKAGE_VERSION).toBe(2);
  });
});
