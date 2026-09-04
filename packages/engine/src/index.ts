export {
  CORPUS_VERIFIED_ON,
  conflictPairs,
  createSchemeCorpus,
} from './corpus';
export {
  assertRuleset,
  compareRulesets,
  evaluate,
  type EvaluationOptions,
} from './evaluate';
export {
  hasEducationAtLeast,
  isSpecialCategory,
  money,
  namedPredicate,
} from './predicates';
export { generateApplicationSequence } from './sequence';
export {
  CURRENT_RULESET,
  CURRENT_RULESET_VERSION,
  HISTORIC_RULESET_VERSION,
  PINNED_RULESETS,
  compareHistoricLink,
  evaluatePinned,
  getInventoryCoverage,
  getRuleset,
  type RulesetVersion,
} from './versions';
export {
  DISTRICT_ALIASES,
  canonicalizeDistrict,
  districtsMatch,
  type TamilNaduDistrict,
} from './districts';
export {
  MatcherInputSchema,
  TAMIL_NADU_DISTRICTS,
  type ApplicationStep,
  type ApplicationStepDefinition,
  type Benefit,
  type Citation,
  type CompatibilityResult,
  type ConfirmationLevel,
  type ConflictPair,
  type ConflictResolution,
  type EligibilityPredicate,
  type EvaluationResult,
  type HistoricComparison,
  type MatcherInput,
  type NearMiss,
  type NonCalculatingSchemeRecord,
  type PredicateOutcome,
  type PredicateResult,
  type PublishedSchemeRule,
  type Ruleset,
  type SchemeDelta,
  type SchemeLevel,
  type SchemeRecord,
  type SchemeResult,
  type SchemeStatus,
} from './types';

export const ENGINE_PACKAGE_VERSION = 2 as const;
