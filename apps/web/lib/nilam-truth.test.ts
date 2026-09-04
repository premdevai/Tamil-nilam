import {
  CURRENT_RULESET_VERSION,
  MatcherInputSchema,
  type MatcherInput,
  type RulesetVersion,
} from '@nilam/engine';
import { describe, expect, it } from 'vitest';

import engineCases from './fixtures/nilam-engine-cases.json';
import {
  DEFAULT_MATCHER_INPUT,
  matcherAsOf,
  parseMatcherState,
  serializeMatcherState,
} from './matcher-state';
import {
  evaluateMatcherSurface,
  matcherParitySnapshot,
  prepareReportSource,
  prepareSavedStackSnapshot,
  prepareShareCardEvaluation,
} from './matcher-surfaces';
import {
  NILAM_SECTOR_MAP,
  canonicalQueryForLegacyHash,
  createNilamMatcherInput,
  evaluateNilamTruth,
  getNilamAssumptions,
  parseLegacyNilamHash,
  type NilamSector,
} from './nilam-truth';

const controls = {
  sector: 'food' as const,
  projectCostLakhs: 110,
  district: 'Thanjavur' as const,
  firstGeneration: true,
  specialCategory: false,
  backwardBlock: true,
  fpoWilling: false,
};

describe('Nilam truth adapter', () => {
  it('evaluates production surfaces on today in India, not a frozen snapshot date', () => {
    expect(matcherAsOf(new Date('2026-10-01T02:00:00+05:30'))).toBe(
      '2026-10-01',
    );
    expect(parseMatcherState({ district: 'Trichy' }).input.district).toBe(
      'Tiruchirappalli',
    );
  });

  it('pins the current default UI profile as a fixture', () => {
    expect(engineCases.find(({ name }) => name === 'default')?.input).toEqual(
      DEFAULT_MATCHER_INPUT,
    );
  });

  it.each(engineCases)(
    'matches the committed $name engine fixture',
    (fixture) => {
      const input = MatcherInputSchema.parse(fixture.input);
      const result = evaluateMatcherSurface(
        input,
        fixture.expected.ruleset as RulesetVersion,
        fixture.asOf,
      );

      expect(
        result.eligible.map(({ schemeId, totalLakhs }) => ({
          id: schemeId,
          totalLakhs,
        })),
      ).toEqual(
        fixture.expected.eligible.map(({ id, totalLakhs }) => ({
          id,
          totalLakhs,
        })),
      );
      expect(result.totalLakhs).toBe(fixture.expected.totalLakhs);
      expect(
        result.nearMisses.map(({ schemeId, failedPredicates }) => ({
          id: schemeId,
          failedPredicateIds: failedPredicates.map(({ id }) => id),
        })),
      ).toEqual(
        fixture.expected.nearMisses.map(({ id, failedPredicateIds }) => ({
          id,
          failedPredicateIds,
        })),
      );
      expect(result.conflicts).toEqual(fixture.expected.conflicts);
      expect(result.sequence.map(({ title }) => title)).toEqual(
        fixture.expected.sequence,
      );
    },
  );

  it.each(Object.entries(NILAM_SECTOR_MAP))(
    'maps the %s UI sector to %s',
    (sector, expected) => {
      expect(
        createNilamMatcherInput({
          ...controls,
          sector: sector as NilamSector,
        }).sector,
      ).toBe(expected);
    },
  );

  it('scales hidden capital and loan with project cost and does not invent rates', () => {
    const scaled = createNilamMatcherInput({
      ...controls,
      projectCostLakhs: 55,
      specialCategory: true,
      backwardBlock: false,
    });
    expect(scaled.eligibleCapitalCostLakhs).toBe(8.8);
    expect(scaled.eligiblePlantMachineryLakhs).toBe(8.8);
    expect(scaled.requestedLoanLakhs).toBe(35.8);
    expect(scaled.specialCategory).toBe('none');
    expect(scaled.locationClass).toBe('rural');
    expect(scaled.backwardBlock).toBe(false);
  });

  it('maps TANSIDCO snapshot district names onto the engine enum', () => {
    expect(
      createNilamMatcherInput({ ...controls, district: 'Trichy' }).district,
    ).toBe('Tiruchirappalli');
    expect(
      createNilamMatcherInput({ ...controls, district: 'Villupuram' }).district,
    ).toBe('Viluppuram');
  });

  it('fails closed when a control cannot produce a canonical input', () => {
    expect(() =>
      createNilamMatcherInput({ ...controls, projectCostLakhs: Number.NaN }),
    ).toThrow();
    expect(() =>
      createNilamMatcherInput({ ...controls, district: 'Not a district' }),
    ).toThrow(/Unknown district/u);
    expect(() =>
      MatcherInputSchema.parse({
        ...DEFAULT_MATCHER_INPUT,
        district: 'Not a district',
      }),
    ).toThrow();
  });

  it('reports hidden facts as assumptions until they are confirmed', () => {
    const assumptions = getNilamAssumptions(DEFAULT_MATCHER_INPUT);
    expect(assumptions.map(({ field }) => field)).toEqual(
      expect.arrayContaining([
        'eligibleCapitalCostLakhs',
        'requestedLoanLakhs',
        'age',
        'enterpriseStage',
        'enterpriseSize',
        'specialCategory',
      ]),
    );
    expect(
      getNilamAssumptions(
        DEFAULT_MATCHER_INPUT,
        new Set(['age', 'enterpriseStage']),
      ).map(({ field }) => field),
    ).not.toEqual(expect.arrayContaining(['age', 'enterpriseStage']));
  });

  it('converts a legacy hash to canonical query state', () => {
    const state = parseLegacyNilamHash(
      '#sec=textiles&pc=40&d=Erode&fg=0&sp=1&bb=0&fpo=1',
    );
    expect(state).not.toBeNull();
    expect(state?.input).toMatchObject({
      sector: 'manufacturing',
      projectCostLakhs: 40,
      district: 'Erode',
      firstGeneration: false,
      specialCategory: 'woman',
      backwardBlock: false,
      locationClass: 'urban',
      fpoWilling: true,
    });
    expect(state?.ruleset).toBe(CURRENT_RULESET_VERSION);

    const query = canonicalQueryForLegacyHash(
      '#sec=textiles&pc=40&d=Erode&fg=0&sp=1&bb=0&fpo=1',
    );
    expect(query).not.toBeNull();
    expect(
      parseMatcherState(
        Object.fromEntries(new URLSearchParams(query ?? '').entries()),
      ).input,
    ).toEqual(state?.input);
  });

  it('separates monetary support from financing access', () => {
    const view = evaluateNilamTruth(DEFAULT_MATCHER_INPUT);
    expect(view.cashSubsidyLakhs).toBeGreaterThan(0);
    expect(
      view.schemes.flatMap(({ benefitGroups }) =>
        benefitGroups.map(({ kind }) => kind),
      ),
    ).toContain('financing-access');
    expect(view.result.pendingVerification).toHaveLength(
      view.inventory.pendingReview,
    );
    expect(
      view.result.pendingVerification.some((pending) =>
        view.schemes.some((scheme) => scheme.schemeId === pending.id),
      ),
    ).toBe(false);
  });

  it('keeps rich, safe, share, save and report surfaces in parity', () => {
    const fixture = engineCases.find(({ name }) => name === 'manufacturing');
    expect(fixture).toBeDefined();
    const input = MatcherInputSchema.parse(fixture?.input);
    const ruleset = fixture?.expected.ruleset as RulesetVersion;
    const query = serializeMatcherState({ input, ruleset });
    const queryValues = Object.fromEntries(
      new URLSearchParams(query).entries(),
    );
    const state = parseMatcherState(queryValues);
    const rich = evaluateNilamTruth(state.input, state.ruleset).result;
    const safe = evaluateMatcherSurface(state.input, state.ruleset);
    const share = prepareShareCardEvaluation(queryValues).result;
    const saved = prepareSavedStackSnapshot(safe);
    const report = prepareReportSource({
      result: safe,
      input: state.input,
      generatedAt: '2026-08-21T00:00:00.000Z',
      siteUrl: 'https://nilam.example',
    });
    const expected = matcherParitySnapshot(rich);

    expect(matcherParitySnapshot(safe)).toEqual(expected);
    expect(matcherParitySnapshot(share)).toEqual(expected);
    expect({
      eligibleSchemeIds: saved.eligibleSchemeSlugs,
      totalLakhs: saved.totalLakhs,
      rulesetVersion: saved.rulesetVersion,
      conflicts: saved.conflicts,
    }).toEqual(expected);
    expect({
      eligibleSchemeIds: report.eligible.map(({ schemeId }) => schemeId),
      totalLakhs: report.totalLakhs,
      rulesetVersion: report.rulesetVersion,
      conflicts: report.conflicts,
    }).toEqual(expected);
  });

  it('rejects fixture inputs that no longer satisfy the canonical schema', () => {
    const malformed = {
      ...(engineCases[0]?.input as MatcherInput),
      eligibleCapitalCostLakhs: 200,
      projectCostLakhs: 100,
    };
    expect(() => MatcherInputSchema.parse(malformed)).toThrow(
      /eligibleCapitalCostLakhs/u,
    );
  });
});
