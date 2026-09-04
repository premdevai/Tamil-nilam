import { describe, expect, it } from 'vitest';

import {
  providerEventId,
  subscriptionStatusForEvent,
  webhookReplayDecision,
} from './payment-state';

describe('payment webhook state', () => {
  it('uses provider event ids when present and hashes otherwise', () => {
    expect(
      providerEventId({ id: 'evt_1', event: 'payment.captured' }, '{}'),
    ).toBe('evt_1');
    expect(
      providerEventId(
        { id: '', event: 'payment.captured', created_at: 1 },
        '{}',
      ),
    ).toHaveLength(64);
  });

  it('maps subscription events onto access states', () => {
    expect(subscriptionStatusForEvent('subscription.activated')).toBe('active');
    expect(subscriptionStatusForEvent('subscription.halted')).toBe('past_due');
    expect(subscriptionStatusForEvent('subscription.cancelled')).toBe(
      'cancelled',
    );
  });

  it('protects against replay and payload substitution', () => {
    expect(webhookReplayDecision(undefined, 'abc')).toBe('missing');
    expect(
      webhookReplayDecision({ processedAt: null, payloadHash: 'one' }, 'two'),
    ).toBe('mismatch');
    expect(
      webhookReplayDecision(
        { processedAt: new Date(), payloadHash: 'one' },
        'one',
      ),
    ).toBe('replayed');
    expect(
      webhookReplayDecision({ processedAt: null, payloadHash: 'one' }, 'one'),
    ).toBe('process');
  });
});
