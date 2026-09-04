import type {
  EligibilityPredicate,
  MatcherInput,
  PredicateOutcome,
} from './types';

export function namedPredicate(
  id: string,
  label: string,
  citationIds: readonly string[],
  evaluate: (input: MatcherInput) => boolean | PredicateOutcome,
): EligibilityPredicate {
  return {
    id,
    label,
    citationIds,
    evaluate: (input) => {
      const outcome = evaluate(input);
      return typeof outcome === 'boolean' ? { passed: outcome } : outcome;
    },
  };
}

export const isSpecialCategory = (input: MatcherInput): boolean =>
  input.specialCategory !== 'none';

const EDUCATION_RANK: Record<MatcherInput['educationLevel'], number> = {
  'below-eighth': 0,
  eighth: 1,
  twelfth: 2,
  iti: 2,
  diploma: 3,
  degree: 4,
};

export const hasEducationAtLeast = (
  input: MatcherInput,
  level: MatcherInput['educationLevel'],
): boolean => EDUCATION_RANK[input.educationLevel] >= EDUCATION_RANK[level];

export const money = (amountLakhs: number): number =>
  Math.round((amountLakhs + Number.EPSILON) * 100) / 100;
