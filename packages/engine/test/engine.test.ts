import { describe, expect, it } from 'vitest';

import {
  CURRENT_RULESET,
  MatcherInputSchema,
  evaluate,
  type Benefit,
  type PublishedSchemeRule,
  type Ruleset,
} from '../src';
import { baseInput, withInput } from './fixtures';

describe('deterministic evaluation', () => {
  it('rejects unknown input fields', () => {
    expect(() =>
      MatcherInputSchema.parse({ ...baseInput, inventedEligibility: true }),
    ).toThrow();
  });

  it('rejects component costs above project cost', () => {
    expect(() =>
      MatcherInputSchema.parse({
        ...baseInput,
        eligibleCapitalCostLakhs: baseInput.projectCostLakhs + 1,
      }),
    ).toThrow();
  });

  it('returns byte-for-byte equivalent values for repeated evaluations', () => {
    const first = evaluate(baseInput, CURRENT_RULESET, {
      asOf: '2026-08-21',
    });
    const second = evaluate(structuredClone(baseInput), CURRENT_RULESET, {
      asOf: '2026-08-21',
    });
    expect(second).toEqual(first);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it('turning off first-generation status removes NEEDS and reports a near miss', () => {
    const eligible = evaluate(baseInput, CURRENT_RULESET, {
      asOf: '2026-08-21',
    });
    const ineligible = evaluate(
      withInput({ firstGeneration: false }),
      CURRENT_RULESET,
      { asOf: '2026-08-21' },
    );

    expect(eligible.eligible.some(({ schemeId }) => schemeId === 'needs')).toBe(
      true,
    );
    expect(
      ineligible.eligible.some(({ schemeId }) => schemeId === 'needs'),
    ).toBe(false);
    expect(
      ineligible.nearMisses
        .find(({ schemeId }) => schemeId === 'needs')
        ?.failedPredicates.map(({ id }) => id),
    ).toEqual(['first-generation']);
  });

  it('keeps the higher cited benefit in a conflict group', () => {
    const needs = CURRENT_RULESET.records.find(
      (record): record is PublishedSchemeRule =>
        record.status === 'published' && record.id === 'needs',
    );
    const uyegp = CURRENT_RULESET.records.find(
      (record): record is PublishedSchemeRule =>
        record.status === 'published' && record.id === 'uyegp',
    );
    expect(needs).toBeDefined();
    expect(uyegp).toBeDefined();
    if (needs === undefined || uyegp === undefined) {
      throw new Error('Fixture rules missing');
    }
    const benefit = (
      rule: PublishedSchemeRule,
      amountLakhs: number,
    ): readonly Benefit[] => [
      {
        id: `${rule.id}-test-benefit`,
        kind: 'capital-subsidy',
        amountLakhs,
        label: 'Test-only cited benefit',
        citationIds: [rule.citations[0]?.id ?? 'missing'],
        calculation: 'exact-input-formula',
      },
    ];
    const replacements: Record<string, PublishedSchemeRule> = {
      needs: {
        ...needs,
        eligibility: [],
        benefits: () => benefit(needs, 10),
      },
      uyegp: {
        ...uyegp,
        eligibility: [],
        benefits: () => benefit(uyegp, 3),
      },
    };
    const ruleset: Ruleset = {
      ...CURRENT_RULESET,
      version: 'test-conflict',
      records: CURRENT_RULESET.records.map(
        (record) => replacements[record.id] ?? record,
      ),
    };

    const result = evaluate(baseInput, ruleset, { asOf: '2026-08-21' });
    expect(result.eligible.some(({ schemeId }) => schemeId === 'needs')).toBe(
      true,
    );
    expect(result.eligible.some(({ schemeId }) => schemeId === 'uyegp')).toBe(
      false,
    );
    expect(result.conflicts).toContainEqual(
      expect.objectContaining({
        keptSchemeId: 'needs',
        droppedSchemeId: 'uyegp',
        confirmedAt: 'inferred',
      }),
    );
  });

  it('surfaces verified AIF and CGTMSE compatibility', () => {
    const result = evaluate(
      withInput({
        sector: 'agri-infrastructure',
        projectCostLakhs: 300,
        eligibleCapitalCostLakhs: 100,
        eligiblePlantMachineryLakhs: 100,
        requestedLoanLakhs: 200,
        firstGeneration: false,
        enterpriseStage: 'existing',
      }),
      CURRENT_RULESET,
      { asOf: '2026-08-21' },
    );
    expect(result.compatibility).toContainEqual(
      expect.objectContaining({
        schemeA: 'aif',
        schemeB: 'cgtmse',
        kind: 'compatible',
        confirmedAt: 'official-guideline',
      }),
    );
  });
});
