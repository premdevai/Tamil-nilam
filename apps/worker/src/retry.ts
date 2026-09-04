import { createHash } from 'node:crypto';

export function notificationIdempotencyKey(parts: {
  userId: string;
  eventId: string;
  channel: 'email' | 'telegram';
}): string {
  return createHash('sha256')
    .update(`${parts.userId}:${parts.eventId}:${parts.channel}`)
    .digest('hex');
}

export function nextRetryAt(
  attemptCount: number,
  now = new Date(),
): Date | undefined {
  if (attemptCount >= 5) return undefined;
  const delaySeconds = Math.min(30 * 2 ** Math.max(0, attemptCount - 1), 3600);
  return new Date(now.getTime() + delaySeconds * 1_000);
}
