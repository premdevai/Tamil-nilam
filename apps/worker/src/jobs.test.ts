import { describe, expect, it } from 'vitest';

import { canClaimDocumentStatus } from './jobs.js';

describe('document job idempotency', () => {
  it('refuses to claim a row already generating or ready', () => {
    expect(canClaimDocumentStatus('queued')).toBe(true);
    expect(canClaimDocumentStatus('failed')).toBe(true);
    expect(canClaimDocumentStatus('generating')).toBe(false);
    expect(canClaimDocumentStatus('ready')).toBe(false);
  });
});
