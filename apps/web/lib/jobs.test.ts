import { describe, expect, it } from 'vitest';

import { can } from './roles';
import {
  authorizationDecision,
  canClaimDocumentStatus,
  checkoutReplayDecision,
} from './jobs';

describe('authorization, payments and job idempotency', () => {
  it('maps missing sessions and missing capabilities to HTTP-style decisions', () => {
    expect(authorizationDecision(false, false)).toBe('unauthorized');
    expect(authorizationDecision(true, can('user', 'publish:write'))).toBe(
      'forbidden',
    );
    expect(authorizationDecision(true, can('admin', 'publish:write'))).toBe(
      'ok',
    );
  });

  it('replays an existing checkout instead of creating a second payment', () => {
    expect(checkoutReplayDecision(undefined)).toBe('create');
    expect(checkoutReplayDecision({ paymentId: 'pay_1' })).toBe('replay');
  });

  it('lets document jobs claim only queued or failed rows', () => {
    expect(canClaimDocumentStatus('queued')).toBe(true);
    expect(canClaimDocumentStatus('failed')).toBe(true);
    expect(canClaimDocumentStatus('generating')).toBe(false);
    expect(canClaimDocumentStatus('ready')).toBe(false);
  });
});
