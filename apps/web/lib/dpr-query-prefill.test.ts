import { describe, expect, it } from 'vitest';

import { queryPrefill } from './dpr-query-prefill';

describe('queryPrefill', () => {
  it('keeps whitelisted keys and drops everything else', () => {
    expect(
      queryPrefill({
        businessName: ' Cold-pressed oil mill ',
        projectCost: '3000000',
        evil: '<script>',
        promoterContribution: ['150000', '1'],
      }),
    ).toEqual({
      businessName: 'Cold-pressed oil mill',
      projectCost: '3000000',
      promoterContribution: '150000',
    });
  });

  it('ignores empty and oversized values', () => {
    expect(queryPrefill({ sector: '', district: 'x'.repeat(2_001) })).toEqual(
      {},
    );
  });
});
