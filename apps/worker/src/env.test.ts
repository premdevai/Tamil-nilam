import { describe, expect, it } from 'vitest';

import { workerEnvSchema } from './env.js';

describe('worker environment', () => {
  it('coerces safe defaults', () => {
    expect(
      workerEnvSchema.parse({
        DATABASE_URL: 'postgresql://nilam:nilam@localhost:5432/nilam',
      }),
    ).toMatchObject({
      LOG_LEVEL: 'info',
      WORKER_CONCURRENCY: 2,
    });
  });
});
