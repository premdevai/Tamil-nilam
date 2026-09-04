import { describe, expect, it } from 'vitest';

import { authOptions, isPersistedUserId } from './auth';

describe('NextAuth adapter', () => {
  it('exposes enumerable methods for NextAuth v4 wrapping', () => {
    expect(Object.keys(authOptions.adapter ?? {})).toEqual(
      expect.arrayContaining([
        'createUser',
        'getSessionAndUser',
        'deleteSession',
        'useVerificationToken',
      ]),
    );
  });

  it('does not treat a NextAuth email placeholder as a user id', () => {
    expect(isPersistedUserId('user@example.com')).toBe(false);
    expect(isPersistedUserId('2f1c0a9e-4b8d-4e6a-9c11-7a0b2d3e4f50')).toBe(
      true,
    );
  });
});
