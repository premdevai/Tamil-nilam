import { describe, expect, it } from 'vitest';

import {
  CURRENT_RULESET,
  CURRENT_RULESET_VERSION,
  HISTORIC_RULESET_VERSION,
  compareHistoricLink,
  evaluate,
  getRuleset,
} from '../src';
import { withInput } from './fixtures';

const foodInput = withInput({
  sector: 'food-processing',
  projectCostLakhs: 25,
  eligibleCapitalCostLakhs: 20,
  eligiblePlantMachineryLakhs: 15,
  requestedLoanLakhs: 16,
  firstGeneration: false,
  enterpriseStage: 'existing',
  enterpriseSize: 'micro',
  repaidMudraTarun: true,
});

describe('deadlines and pinned rulesets', () => {
  it('includes PMFME on the verified final day and excludes it the day after', () => {
    const finalDay = evaluate(foodInput, CURRENT_RULESET, {
      asOf: '2026-09-30',
    });
    const dayAfter = evaluate(foodInput, CURRENT_RULESET, {
      asOf: '2026-10-01',
    });

    expect(finalDay.eligible.some(({ schemeId }) => schemeId === 'pmfme')).toBe(
      true,
    );
    expect(dayAfter.eligible.some(({ schemeId }) => schemeId === 'pmfme')).toBe(
      false,
    );
    expect(
      dayAfter.nearMisses
        .find(({ schemeId }) => schemeId === 'pmfme')
        ?.failedPredicates.map(({ id }) => id),
    ).toContain('deadline-open');
  });

  it('has a sunset assertion for every deadline-bearing published rule', () => {
    const deadlineRules = CURRENT_RULESET.records.filter(
      (record) => record.status === 'published' && record.deadline !== null,
    );
    expect(deadlineRules.map(({ id }) => id)).toEqual(['pmfme']);
    for (const rule of deadlineRules) {
      const afterDeadline = new Date(`${rule.deadline}T00:00:00.000Z`);
      afterDeadline.setUTCDate(afterDeadline.getUTCDate() + 1);
      const result = evaluate(foodInput, CURRENT_RULESET, {
        asOf: afterDeadline.toISOString().slice(0, 10),
      });
      expect(result.eligible.some(({ schemeId }) => schemeId === rule.id)).toBe(
        false,
      );
    }
  });

  it('recomputes a historic link against the current PMFME extension', () => {
    const comparison = compareHistoricLink(
      foodInput,
      HISTORIC_RULESET_VERSION,
      { asOf: '2026-08-21' },
      CURRENT_RULESET_VERSION,
    );

    expect(comparison.before.rulesetVersion).toBe(HISTORIC_RULESET_VERSION);
    expect(comparison.after.rulesetVersion).toBe(CURRENT_RULESET_VERSION);
    expect(
      comparison.before.eligible.some(({ schemeId }) => schemeId === 'pmfme'),
    ).toBe(false);
    expect(
      comparison.after.eligible.some(({ schemeId }) => schemeId === 'pmfme'),
    ).toBe(true);
    expect(comparison.totalDeltaLakhs).toBe(7);
    expect(comparison.schemeDeltas).toContainEqual({
      schemeId: 'pmfme',
      beforeLakhs: 0,
      afterLakhs: 7,
      deltaLakhs: 7,
      eligibilityChanged: true,
    });
  });

  it('reports non-monetary eligibility changes between pinned versions', () => {
    const comparison = compareHistoricLink(
      withInput({
        sector: 'agri-infrastructure',
        projectCostLakhs: 1_000,
        eligibleCapitalCostLakhs: 200,
        eligiblePlantMachineryLakhs: 200,
        requestedLoanLakhs: 700,
        firstGeneration: false,
        enterpriseStage: 'existing',
      }),
      HISTORIC_RULESET_VERSION,
      { asOf: '2026-08-21' },
    );
    expect(comparison.schemeDeltas).toContainEqual({
      schemeId: 'cgtmse',
      beforeLakhs: 0,
      afterLakhs: 0,
      deltaLakhs: 0,
      eligibilityChanged: true,
    });
  });

  it('fails closed for an unknown ruleset version', () => {
    expect(() => getRuleset('latest')).toThrow(/Unknown pinned ruleset/u);
  });
});
