import { afterEach, describe, expect, it, vi } from 'vitest';

import { createDeliveryTransport } from './transports';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('notification transports', () => {
  it.each(['email', 'telegram'] as const)(
    'delivers %s locally without live credentials',
    async (channel) => {
      vi.spyOn(console, 'info').mockImplementation(() => undefined);
      const transport = createDeliveryTransport({ NODE_ENV: 'test' });
      await expect(
        transport.send({
          channel,
          destination: channel === 'email' ? 'user@example.com' : '123456',
          subject: 'NILAM update',
          body: 'Verified change',
        }),
      ).resolves.toMatch(new RegExp(`^local-${channel}:`));
    },
  );

  it('fails closed for missing production credentials', async () => {
    const transport = createDeliveryTransport({ NODE_ENV: 'production' });
    await expect(
      transport.send({
        channel: 'telegram',
        destination: '123456',
        subject: 'NILAM update',
        body: 'Verified change',
      }),
    ).rejects.toThrow('TELEGRAM_BOT_TOKEN is required');
  });
});
