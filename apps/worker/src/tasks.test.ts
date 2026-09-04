import type { JobHelpers } from 'graphile-worker';
import { describe, expect, it, vi } from 'vitest';

import { createTaskList } from './tasks';

describe('worker task SQL', () => {
  it('scans owned projects before creating personal scheme impacts', async () => {
    const query = vi.fn().mockResolvedValueOnce({ rows: [] });
    const task = createTaskList({
      send: vi.fn().mockResolvedValue('unused'),
    }).calculate_go_impact;

    expect(task).toBeDefined();
    await task?.(
      {
        schemeSlug: 'audit-scheme',
        versionKey: 'v2',
        summary: 'Verified test summary',
        citationUrl: 'https://example.gov.in/go/v2',
      },
      { query } as unknown as JobHelpers,
    );

    expect(query).toHaveBeenCalledOnce();
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('from saved_stacks ss'),
      [null],
    );
  });
});
