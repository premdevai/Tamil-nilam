export type SessionRole = 'user' | 'consultant' | 'reviewer' | 'admin';

export type Capability =
  | 'account:read'
  | 'account:write'
  | 'saves:write'
  | 'operations:read'
  | 'review:write'
  | 'publish:write'
  | 'roles:write';

const CAPABILITIES: Readonly<Record<SessionRole, readonly Capability[]>> = {
  user: ['account:read', 'account:write', 'saves:write'],
  consultant: ['account:read', 'account:write', 'saves:write'],
  reviewer: [
    'account:read',
    'account:write',
    'saves:write',
    'operations:read',
    'review:write',
  ],
  admin: [
    'account:read',
    'account:write',
    'saves:write',
    'operations:read',
    'review:write',
    'publish:write',
    'roles:write',
  ],
};

export function can(role: SessionRole, capability: Capability): boolean {
  return CAPABILITIES[role].includes(capability);
}
