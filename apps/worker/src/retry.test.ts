import { describe, expect, it } from 'vitest';

import { nextRetryAt, notificationIdempotencyKey } from './retry';

describe('notification delivery controls', () => {
  it('uses stable channel-specific idempotency keys', () => {
    const email = notificationIdempotencyKey({
      userId: 'user-1',
      eventId: 'event-1',
      channel: 'email',
    });
    expect(email).toBe(
      notificationIdempotencyKey({
        userId: 'user-1',
        eventId: 'event-1',
        channel: 'email',
      }),
    );
    expect(email).not.toBe(
      notificationIdempotencyKey({
        userId: 'user-1',
        eventId: 'event-1',
        channel: 'telegram',
      }),
    );
  });

  it('backs off and permanently stops after five attempts', () => {
    const now = new Date('2026-08-21T00:00:00.000Z');
    expect(nextRetryAt(1, now)?.toISOString()).toBe('2026-08-21T00:00:30.000Z');
    expect(nextRetryAt(4, now)?.toISOString()).toBe('2026-08-21T00:04:00.000Z');
    expect(nextRetryAt(5, now)).toBeUndefined();
  });
});
