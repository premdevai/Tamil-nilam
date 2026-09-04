import { z } from 'zod';

import { resolveConflicts } from './conflicts';
import { money } from './predicates';
import { generateApplicationSequence } from './sequence';
import {
  MatcherInputSchema,
  type EvaluationResult,
  type HistoricComparison,
  type MatcherInput,
  type NearMiss,
  type NonCalculatingSchemeRecord,
  type PredicateResult,
  type PublishedSchemeRule,
  type Ruleset,
  type SchemeDelta,
  type SchemeResult,
} from './types';

const IsoDateSchema = z.iso.date();

export interface EvaluationOptions {
  readonly asOf: string;
  readonly nearMissMaximumFailures?: number;
}

const deadlinePredicate = (
  rule: PublishedSchemeRule,
  asOf: string,
): PredicateResult | null => {
  if (rule.deadline === null) {
    return null;
  }
  const citationIds = rule.citations.map(({ id }) => id);
  return {
    id: 'deadline-open',
    label: `Application window open through ${rule.deadline}`,
    passed: asOf <= rule.deadline,
    actual: asOf,
    citationIds,
  };
};

function evaluatePredicates(
  rule: PublishedSchemeRule,
  input: MatcherInput,
  asOf: string,
): readonly PredicateResult[] {
  const predicateResults = rule.eligibility.map((predicate) => {
    const outcome = predicate.evaluate(input);
    return {
      id: predicate.id,
      label: predicate.label,
      passed: outcome.passed,
      citationIds: predicate.citationIds,
      ...(outcome.actual === undefined ? {} : { actual: outcome.actual }),
    };
  });
  const deadline = deadlinePredicate(rule, asOf);
  return deadline === null ? predicateResults : [...predicateResults, deadline];
}

const sumBenefits = (result: SchemeResult): number =>
  money(
    result.benefits.reduce(
      (total, benefit) => total + (benefit.amountLakhs ?? 0),
      0,
    ),
  );

export function assertRuleset(ruleset: Ruleset): void {
  if (ruleset.records.length !== 24) {
    throw new Error(
      `Ruleset ${ruleset.version} must contain 24 inventory records; found ${ruleset.records.length}`,
    );
  }

  const recordIds = new Set<string>();
  for (const record of ruleset.records) {
    if (recordIds.has(record.id)) {
      throw new Error(`Duplicate scheme record ${record.id}`);
    }
    recordIds.add(record.id);
    if (record.citations.length === 0) {
      throw new Error(`Scheme ${record.id} has no primary-source citation`);
    }
    const citationIds = new Set<string>();
    for (const source of record.citations) {
      if (citationIds.has(source.id)) {
        throw new Error(`Scheme ${record.id} repeats citation ${source.id}`);
      }
      citationIds.add(source.id);
      IsoDateSchema.parse(source.verifiedOn);
      if (!/^https?:\/\//u.test(source.url)) {
        throw new Error(`Citation ${source.id} does not contain an HTTP URL`);
      }
    }
    if (record.deadline !== null) {
      IsoDateSchema.parse(record.deadline);
    }
    if (record.status !== 'published') {
      continue;
    }
    const predicateIds = new Set<string>();
    for (const predicate of record.eligibility) {
      if (predicateIds.has(predicate.id)) {
        throw new Error(
          `Scheme ${record.id} repeats predicate ${predicate.id}`,
        );
      }
      predicateIds.add(predicate.id);
      for (const citationId of predicate.citationIds) {
        if (!citationIds.has(citationId)) {
          throw new Error(
            `Predicate ${record.id}/${predicate.id} references unknown citation ${citationId}`,
          );
        }
      }
    }
  }

  for (const pair of ruleset.conflictPairs) {
    if (!recordIds.has(pair.schemeA) || !recordIds.has(pair.schemeB)) {
      throw new Error(
        `Conflict pair references an unknown scheme: ${pair.schemeA}/${pair.schemeB}`,
      );
    }
    IsoDateSchema.parse(pair.verifiedOn);
  }
}

export function evaluate(
  rawInput: unknown,
  ruleset: Ruleset,
  options: EvaluationOptions,
): EvaluationResult {
  assertRuleset(ruleset);
  const input = MatcherInputSchema.parse(rawInput);
  const asOf = IsoDateSchema.parse(options.asOf);
  const maximumFailures = options.nearMissMaximumFailures ?? 2;
  if (!Number.isInteger(maximumFailures) || maximumFailures < 1) {
    throw new Error('nearMissMaximumFailures must be a positive integer');
  }

  const publishedRules = ruleset.records.filter(
    (record): record is PublishedSchemeRule => record.status === 'published',
  );
  const candidates: SchemeResult[] = [];
  const nearMisses: NearMiss[] = [];

  for (const rule of publishedRules) {
    const predicates = evaluatePredicates(rule, input, asOf);
    const failedPredicates = predicates.filter(({ passed }) => !passed);
    if (failedPredicates.length > 0) {
      if (failedPredicates.length <= maximumFailures) {
        nearMisses.push({
          schemeId: rule.id,
          name: rule.name,
          failedPredicates,
          passedPredicateCount: predicates.length - failedPredicates.length,
        });
      }
      continue;
    }

    const citationIds = new Set(rule.citations.map(({ id }) => id));
    const benefits = rule.benefits(input);
    for (const benefit of benefits) {
      if (
        benefit.amountLakhs !== null &&
        (!Number.isFinite(benefit.amountLakhs) || benefit.amountLakhs < 0)
      ) {
        throw new Error(
          `Benefit ${rule.id}/${benefit.id} produced an invalid amount`,
        );
      }
      if (benefit.citationIds.length === 0) {
        throw new Error(`Benefit ${rule.id}/${benefit.id} has no citation`);
      }
      for (const citationId of benefit.citationIds) {
        if (!citationIds.has(citationId)) {
          throw new Error(
            `Benefit ${rule.id}/${benefit.id} references unknown citation ${citationId}`,
          );
        }
      }
    }
    const result: SchemeResult = {
      schemeId: rule.id,
      name: rule.name,
      nameTa: rule.nameTa,
      predicates,
      benefits,
      totalLakhs: 0,
      deadline: rule.deadline,
      citations: rule.citations,
      caveats: rule.caveats,
    };
    candidates.push({ ...result, totalLakhs: sumBenefits(result) });
  }

  const conflictOutcome = resolveConflicts(
    candidates,
    publishedRules,
    ruleset.conflictPairs,
  );
  const keptRules = conflictOutcome.kept.map((result) => {
    const rule = publishedRules.find(({ id }) => id === result.schemeId);
    if (rule === undefined) {
      throw new Error(`Missing published rule ${result.schemeId}`);
    }
    return rule;
  });
  const rawTotal = money(
    conflictOutcome.kept.reduce(
      (total, result) => total + result.totalLakhs,
      0,
    ),
  );
  const totalLakhs = money(Math.min(rawTotal, input.projectCostLakhs));
  const warnings = [
    'All monetary outputs are directional pre-sanction calculations from cited formulas and supplied eligible-cost inputs.',
    'Unknown or inferred compatibility must be confirmed in writing with the relevant authority.',
    ...(rawTotal > input.projectCostLakhs
      ? [
          `Calculated assistance total ₹${rawTotal} lakh exceeded project cost and was capped at ₹${input.projectCostLakhs} lakh.`,
        ]
      : []),
  ];
  const pendingVerification = ruleset.records.filter(
    (record): record is NonCalculatingSchemeRecord =>
      record.status === 'pending-review',
  );
  const retired = ruleset.records.filter(
    (record): record is NonCalculatingSchemeRecord =>
      record.status === 'retired',
  );

  return {
    rulesetVersion: ruleset.version,
    asOf,
    input,
    eligible: conflictOutcome.kept,
    nearMisses: nearMisses.sort(
      (a, b) =>
        a.failedPredicates.length - b.failedPredicates.length ||
        a.schemeId.localeCompare(b.schemeId),
    ),
    conflicts: conflictOutcome.conflicts,
    compatibility: conflictOutcome.compatibility,
    sequence: generateApplicationSequence(keptRules),
    totalLakhs,
    pendingVerification,
    retired,
    warnings,
  };
}

export function compareRulesets(
  rawInput: unknown,
  from: Ruleset,
  to: Ruleset,
  options: EvaluationOptions,
): HistoricComparison {
  const before = evaluate(rawInput, from, options);
  const after = evaluate(rawInput, to, options);
  const schemeIds = new Set([
    ...before.eligible.map(({ schemeId }) => schemeId),
    ...after.eligible.map(({ schemeId }) => schemeId),
  ]);
  const schemeDeltas: SchemeDelta[] = [...schemeIds].sort().map((schemeId) => {
    const beforeResult = before.eligible.find(
      (result) => result.schemeId === schemeId,
    );
    const afterResult = after.eligible.find(
      (result) => result.schemeId === schemeId,
    );
    const beforeLakhs = beforeResult?.totalLakhs ?? 0;
    const afterLakhs = afterResult?.totalLakhs ?? 0;
    return {
      schemeId,
      beforeLakhs,
      afterLakhs,
      deltaLakhs: money(afterLakhs - beforeLakhs),
      eligibilityChanged:
        (beforeResult === undefined) !== (afterResult === undefined),
    };
  });

  return {
    fromVersion: from.version,
    toVersion: to.version,
    before,
    after,
    totalDeltaLakhs: money(after.totalLakhs - before.totalLakhs),
    schemeDeltas,
  };
}
