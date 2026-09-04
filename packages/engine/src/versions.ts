import { conflictPairs, createSchemeCorpus } from './corpus';
import { compareRulesets, evaluate, type EvaluationOptions } from './evaluate';
import type {
  EvaluationResult,
  HistoricComparison,
  Ruleset,
  SchemeStatus,
} from './types';

export const HISTORIC_RULESET_VERSION = '2025.03' as const;
export const CURRENT_RULESET_VERSION = '2026.08' as const;

const historicRuleset: Ruleset = {
  version: HISTORIC_RULESET_VERSION,
  effectiveFrom: '2025-03-01',
  effectiveTo: '2026-05-31',
  records: createSchemeCorpus({
    pmfmeDeadline: '2025-03-31',
    cgtmseLimitLakhs: 500,
    mudraLimitLakhs: 10,
  }),
  conflictPairs,
  changelog: [
    'Pinned pre-extension PMFME deadline at 31 March 2025.',
    'Pinned CGTMSE coverage ceiling at ₹5 crore.',
    'Pinned MUDRA ceiling at ₹10 lakh.',
  ],
};

const currentRuleset: Ruleset = {
  version: CURRENT_RULESET_VERSION,
  effectiveFrom: '2026-06-01',
  effectiveTo: null,
  records: createSchemeCorpus({
    pmfmeDeadline: '2026-09-30',
    cgtmseLimitLakhs: 1_000,
    mudraLimitLakhs: 20,
  }),
  conflictPairs,
  changelog: [
    'Verified temporary PMFME extension through 30 September 2026.',
    'Applied CGTMSE ₹10 crore ceiling effective 1 April 2025.',
    'Applied MUDRA Tarun Plus ceiling of ₹20 lakh with repayment predicate.',
    'Retired Stand-Up India after its official 31 March 2025 end date.',
    'Separated unverified programmes from calculating published rules.',
    'Treat NEEDS and PMEGP as exclusive capital subsidies until written stacking evidence exists.',
  ],
};

export const PINNED_RULESETS = Object.freeze({
  [HISTORIC_RULESET_VERSION]: historicRuleset,
  [CURRENT_RULESET_VERSION]: currentRuleset,
});

export type RulesetVersion = keyof typeof PINNED_RULESETS;

export const CURRENT_RULESET = PINNED_RULESETS[CURRENT_RULESET_VERSION];

export function getRuleset(version: string): Ruleset {
  const ruleset = (PINNED_RULESETS as Readonly<Record<string, Ruleset>>)[
    version
  ];
  if (ruleset === undefined) {
    throw new Error(`Unknown pinned ruleset version: ${version}`);
  }
  return ruleset;
}

export function evaluatePinned(
  rawInput: unknown,
  version: string,
  options: EvaluationOptions,
): EvaluationResult {
  return evaluate(rawInput, getRuleset(version), options);
}

export function compareHistoricLink(
  rawInput: unknown,
  historicVersion: string,
  options: EvaluationOptions,
  currentVersion: string = CURRENT_RULESET_VERSION,
): HistoricComparison {
  return compareRulesets(
    rawInput,
    getRuleset(historicVersion),
    getRuleset(currentVersion),
    options,
  );
}

export function getInventoryCoverage(ruleset: Ruleset = CURRENT_RULESET): {
  readonly total: number;
  readonly published: number;
  readonly pendingReview: number;
  readonly retired: number;
} {
  const count = (status: SchemeStatus): number =>
    ruleset.records.filter((record) => record.status === status).length;
  return {
    total: ruleset.records.length,
    published: count('published'),
    pendingReview: count('pending-review'),
    retired: count('retired'),
  };
}
