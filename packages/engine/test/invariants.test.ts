import { describe, expect, it } from 'vitest';

import {
  CURRENT_RULESET,
  TAMIL_NADU_DISTRICTS,
  assertRuleset,
  evaluate,
  getInventoryCoverage,
  type MatcherInput,
  type PublishedSchemeRule,
  type Ruleset,
} from '../src';

const sectors: readonly MatcherInput['sector'][] = [
  'agri-infrastructure',
  'food-processing',
  'manufacturing',
  'services',
  'trading',
  'traditional-industry',
  'other',
];
const sizes: readonly MatcherInput['enterpriseSize'][] = [
  'micro',
  'small',
  'medium',
  'not-msme',
];
const categories: readonly MatcherInput['specialCategory'][] = [
  'none',
  'woman',
  'sc',
  'st',
  'bc',
  'mbc',
  'minority',
  'ex-serviceman',
  'transgender',
  'differently-abled',
];

function pseudoRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function generatedInput(random: () => number): MatcherInput {
  const projectCostLakhs = Math.max(1, Math.round(random() * 500_000) / 100);
  const withinProject = (): number =>
    Math.round(random() * projectCostLakhs * 100) / 100;
  return {
    sector: sectors[Math.floor(random() * sectors.length)] ?? 'other',
    projectCostLakhs,
    eligibleCapitalCostLakhs: withinProject(),
    eligiblePlantMachineryLakhs: withinProject(),
    requestedLoanLakhs: withinProject(),
    district:
      TAMIL_NADU_DISTRICTS[
        Math.floor(random() * TAMIL_NADU_DISTRICTS.length)
      ] ?? 'Chennai',
    locationClass: random() > 0.5 ? 'urban' : 'rural',
    backwardBlock: random() > 0.5,
    firstGeneration: random() > 0.5,
    age: 18 + Math.floor(random() * 65),
    specialCategory:
      categories[Math.floor(random() * categories.length)] ?? 'none',
    fpoWilling: random() > 0.5,
    entityKind:
      (
        [
          'proprietorship',
          'partnership',
          'company',
          'cooperative',
          'fpo',
          'shg',
          'other',
        ] as const
      )[Math.floor(random() * 7)] ?? 'other',
    enterpriseStage: random() > 0.5 ? 'new' : 'existing',
    enterpriseSize: sizes[Math.floor(random() * sizes.length)] ?? 'not-msme',
    educationLevel:
      (
        [
          'below-eighth',
          'eighth',
          'twelfth',
          'iti',
          'diploma',
          'degree',
        ] as const
      )[Math.floor(random() * 6)] ?? 'below-eighth',
    annualFamilyIncomeLakhs: Math.round(random() * 2_000) / 100,
    priorGovernmentCapitalSubsidy: random() > 0.7,
    repaidMudraTarun: random() > 0.5,
    udyamRegistered: random() > 0.2,
  };
}

describe('ruleset and property invariants', () => {
  it('contains 24 cited records with explicit review states', () => {
    expect(() => assertRuleset(CURRENT_RULESET)).not.toThrow();
    expect(getInventoryCoverage()).toEqual({
      total: 24,
      published: 9,
      pendingReview: 13,
      retired: 2,
    });
    for (const record of CURRENT_RULESET.records) {
      expect(record.citations.length).toBeGreaterThan(0);
      expect(record.citations.every(({ primary }) => primary)).toBe(true);
      expect(
        record.citations.every(({ verifiedOn }) => verifiedOn.length > 0),
      ).toBe(true);
    }
  });

  it('preserves monetary, conflict and total invariants across generated inputs', () => {
    const random = pseudoRandom(0x4e494c41);
    const publishedRules = CURRENT_RULESET.records.filter(
      (record): record is PublishedSchemeRule => record.status === 'published',
    );
    const rulesById = new Map(publishedRules.map((rule) => [rule.id, rule]));

    for (let index = 0; index < 300; index += 1) {
      const input = generatedInput(random);
      const first = evaluate(input, CURRENT_RULESET, { asOf: '2026-08-21' });
      const second = evaluate(input, CURRENT_RULESET, { asOf: '2026-08-21' });
      expect(second).toEqual(first);
      expect(first.totalLakhs).toBeLessThanOrEqual(input.projectCostLakhs);

      const winningGroups = new Set<string>();
      for (const result of first.eligible) {
        const group = rulesById.get(result.schemeId)?.conflictGroup;
        if (group !== undefined) {
          expect(winningGroups.has(group)).toBe(false);
          winningGroups.add(group);
        }
        for (const benefit of result.benefits) {
          if (benefit.amountLakhs !== null) {
            expect(benefit.amountLakhs).toBeGreaterThanOrEqual(0);
            expect(benefit.citationIds.length).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it('fails closed when a monetary benefit loses its citation', () => {
    const needs = CURRENT_RULESET.records.find(
      (record): record is PublishedSchemeRule =>
        record.status === 'published' && record.id === 'needs',
    );
    expect(needs).toBeDefined();
    if (needs === undefined) {
      throw new Error('NEEDS rule missing');
    }
    const broken: PublishedSchemeRule = {
      ...needs,
      benefits: () => [
        {
          id: 'uncited',
          kind: 'capital-subsidy',
          amountLakhs: 1,
          label: 'Invalid uncited amount',
          citationIds: [],
          calculation: 'exact-input-formula',
        },
      ],
    };
    const ruleset: Ruleset = {
      ...CURRENT_RULESET,
      version: 'broken-citation',
      records: CURRENT_RULESET.records.map((record) =>
        record.id === needs.id ? broken : record,
      ),
    };
    const input = generatedInput(pseudoRandom(7));
    const eligibleNeedsInput: MatcherInput = {
      ...input,
      sector: 'manufacturing',
      projectCostLakhs: 100,
      eligibleCapitalCostLakhs: 60,
      eligiblePlantMachineryLakhs: 60,
      requestedLoanLakhs: 50,
      firstGeneration: true,
      age: 30,
    };
    expect(() =>
      evaluate(eligibleNeedsInput, ruleset, { asOf: '2026-08-21' }),
    ).toThrow(/has no citation/u);
  });
});
