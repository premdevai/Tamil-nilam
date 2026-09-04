import { parseCrontab } from 'graphile-worker';
import { describe, expect, it } from 'vitest';

import { WORKER_CRONTAB } from './cron.js';

describe('worker crontab', () => {
  it('uses syntax accepted by the installed Graphile Worker', () => {
    expect(parseCrontab(WORKER_CRONTAB)).toHaveLength(4);
  });
});
