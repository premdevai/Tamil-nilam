import { describe, expect, it } from 'vitest';

import {
  CURRENT_RULESET_VERSION,
  evaluatePinned,
  type MatcherInput,
} from '../src';
import goldenFixtures from './golden/ruleset-2026.08.json';
import { withInput } from './fixtures';

describe('ruleset 2026.08 golden fixtures', () => {
  for (const fixture of goldenFixtures) {
    it(fixture.name, () => {
      const result = evaluatePinned(
        withInput(fixture.overrides as Partial<MatcherInput>),
        CURRENT_RULESET_VERSION,
        { asOf: fixture.asOf },
      );

      expect(result.eligible.map(({ schemeId }) => schemeId)).toEqual(
        fixture.expectedEligible,
      );
      expect(result.totalLakhs).toBe(fixture.expectedTotalLakhs);
    });
  }
});
