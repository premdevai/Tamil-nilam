import { describe, expect, it } from 'vitest';

import { can } from './roles';

describe('role capabilities', () => {
  it('keeps normal and consultant accounts out of operations', () => {
    expect(can('user', 'operations:read')).toBe(false);
    expect(can('consultant', 'review:write')).toBe(false);
    expect(can('user', 'saves:write')).toBe(true);
  });

  it('allows reviewers to review but not publish or manage roles', () => {
    expect(can('reviewer', 'operations:read')).toBe(true);
    expect(can('reviewer', 'review:write')).toBe(true);
    expect(can('reviewer', 'publish:write')).toBe(false);
    expect(can('reviewer', 'roles:write')).toBe(false);
  });

  it('reserves publication and role changes for admins', () => {
    expect(can('admin', 'publish:write')).toBe(true);
    expect(can('admin', 'roles:write')).toBe(true);
  });
});
