import { describe, expect, it } from 'vitest';

import {
  canPublishReview,
  nextPublicationVersion,
  publicationSideEffects,
} from './publish';

describe('publish workflow', () => {
  it('only publishes an approved review into the next append-only version', () => {
    expect(canPublishReview('pending')).toBe(false);
    expect(canPublishReview('approved')).toBe(true);
    expect(nextPublicationVersion(undefined)).toBe(1);
    expect(nextPublicationVersion(3)).toBe(4);
  });

  it('queues search, revalidation and impact work for every publication', () => {
    expect(publicationSideEffects('scheme', 'tn-capital-subsidy')).toEqual([
      {
        kind: 'search-index',
        payload: { entityType: 'scheme', entityKey: 'tn-capital-subsidy' },
      },
      {
        kind: 'revalidate',
        payload: { entityType: 'scheme', entityKey: 'tn-capital-subsidy' },
      },
      {
        kind: 'calculate-impact',
        payload: { entityType: 'scheme', entityKey: 'tn-capital-subsidy' },
      },
    ]);
  });
});
