import {
  evaluatePinned,
  type EvaluationResult,
  type MatcherInput,
} from '@nilam/engine';

import { MATCHER_AS_OF, parseMatcherState } from './matcher-state';

export function evaluateMatcherSurface(
  input: MatcherInput,
  ruleset: string,
  asOf = MATCHER_AS_OF,
): EvaluationResult {
  return evaluatePinned(input, ruleset, { asOf });
}

export function matcherParitySnapshot(result: EvaluationResult) {
  return {
    eligibleSchemeIds: result.eligible.map(({ schemeId }) => schemeId),
    totalLakhs: result.totalLakhs,
    rulesetVersion: result.rulesetVersion,
    conflicts: result.conflicts.map(
      ({ keptSchemeId, droppedSchemeId, kind }) => ({
        keptSchemeId,
        droppedSchemeId,
        kind,
      }),
    ),
  };
}

export function prepareShareCardEvaluation(
  values: Readonly<Record<string, string | string[] | undefined>>,
) {
  const state = parseMatcherState(values);
  return {
    state,
    result: evaluateMatcherSurface(state.input, state.ruleset),
  };
}

export function prepareSavedStackSnapshot(result: EvaluationResult) {
  const parity = matcherParitySnapshot(result);
  return {
    eligibleSchemeSlugs: parity.eligibleSchemeIds,
    totalLakhs: parity.totalLakhs,
    schemeTotals: Object.fromEntries(
      result.eligible.map((scheme) => [scheme.schemeId, scheme.totalLakhs]),
    ),
    deadlines: Object.fromEntries(
      result.eligible.map((scheme) => [scheme.schemeId, scheme.deadline]),
    ),
    nextAction:
      result.sequence[0] === undefined
        ? null
        : {
            title: result.sequence[0].title,
            organisation: result.sequence[0].organisation,
            schemeIds: result.sequence[0].schemeIds,
          },
    rulesetVersion: parity.rulesetVersion,
    conflicts: parity.conflicts,
  };
}

export function prepareReportSource({
  result,
  input,
  title,
  generatedAt,
  siteUrl,
}: {
  readonly result: EvaluationResult;
  readonly input: MatcherInput;
  readonly title?: string;
  readonly generatedAt: string;
  readonly siteUrl: string;
}) {
  const citations = result.eligible
    .flatMap((scheme) =>
      scheme.citations.map((citation) => ({
        title: citation.title,
        url: citation.url,
        verifiedOn: citation.verifiedOn,
      })),
    )
    .slice(0, 100);

  return {
    title: title ?? `Pro report — ${input.district} ${input.sector}`,
    generatedAt,
    asOf: result.asOf,
    rulesetVersion: result.rulesetVersion,
    district: input.district,
    sector: input.sector,
    totalLakhs: result.totalLakhs,
    eligible: result.eligible.map((scheme) => ({
      schemeId: scheme.schemeId,
      name: scheme.name,
      totalLakhs: scheme.totalLakhs,
    })),
    conflicts: matcherParitySnapshot(result).conflicts,
    warnings: [...result.warnings],
    citations:
      citations.length > 0
        ? citations
        : [
            {
              title: 'NILAM',
              url: siteUrl,
              verifiedOn: result.asOf,
            },
          ],
  };
}
