import { CURRENT_RULESET_VERSION, evaluatePinned } from '@nilam/engine';
import { describe, expect, it } from 'vitest';

import { projectImpactDiff } from './project-impact';

const input = {
  sector: 'food-processing' as const,
  projectCostLakhs: 110,
  eligibleCapitalCostLakhs: 17.6,
  eligiblePlantMachineryLakhs: 17.6,
  requestedLoanLakhs: 71.5,
  district: 'Thanjavur' as const,
  locationClass: 'rural' as const,
  backwardBlock: true,
  firstGeneration: true,
  age: 30,
  specialCategory: 'none' as const,
  fpoWilling: false,
  entityKind: 'proprietorship' as const,
  enterpriseStage: 'new' as const,
  enterpriseSize: 'micro' as const,
  educationLevel: 'twelfth' as const,
  annualFamilyIncomeLakhs: 5,
  priorGovernmentCapitalSubsidy: false,
  repaidMudraTarun: false,
  udyamRegistered: false,
};

describe('personal project impact', () => {
  it('emits only material changes supported by the prior project snapshot', () => {
    const current = evaluatePinned(input, CURRENT_RULESET_VERSION, {
      asOf: '2026-08-22',
    });
    const scheme = current.eligible[0];
    if (scheme === undefined) throw new Error('Expected an eligible scheme.');
    const next = current.sequence[0];
    const diffs = projectImpactDiff(
      {
        eligibleSchemeSlugs: current.eligible.map((item) => item.schemeId),
        schemeTotals: { [scheme.schemeId]: scheme.totalLakhs - 1 },
        deadlines: { [scheme.schemeId]: scheme.deadline },
        nextAction:
          next === undefined
            ? null
            : {
                title: next.title,
                organisation: next.organisation,
                schemeIds: next.schemeIds,
              },
      },
      current,
      scheme.schemeId,
    );
    expect(diffs).toEqual([
      expect.objectContaining({
        field: 'amount',
        before: scheme.totalLakhs - 1,
        after: scheme.totalLakhs,
      }),
    ]);
  });

  it('does not infer amount or deadline changes from legacy snapshots', () => {
    const current = evaluatePinned(input, CURRENT_RULESET_VERSION, {
      asOf: '2026-08-22',
    });
    const scheme = current.eligible[0];
    if (scheme === undefined) throw new Error('Expected an eligible scheme.');
    expect(
      projectImpactDiff(
        {
          eligibleSchemeSlugs: current.eligible.map((item) => item.schemeId),
          totalLakhs: current.totalLakhs,
        },
        current,
        scheme.schemeId,
      ),
    ).toEqual([]);
  });
});
