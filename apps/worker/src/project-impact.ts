import type { EvaluationResult } from '@nilam/engine';

export type ProjectImpactDiff = {
  readonly field: 'amount' | 'eligibility' | 'deadline' | 'next_action';
  readonly before: unknown;
  readonly after: unknown;
};

export function projectImpactDiff(
  snapshot: Record<string, unknown>,
  current: EvaluationResult,
  schemeSlug: string,
): readonly ProjectImpactDiff[] {
  const eligible = stringArray(snapshot.eligibleSchemeSlugs);
  const currentScheme = current.eligible.find(
    (scheme) => scheme.schemeId === schemeSlug,
  );
  const diffs: ProjectImpactDiff[] = [];
  const wasEligible = eligible.includes(schemeSlug);
  const isEligible = currentScheme !== undefined;
  if (wasEligible !== isEligible) {
    diffs.push({
      field: 'eligibility',
      before: wasEligible,
      after: isEligible,
    });
  }

  const schemeTotals = record(snapshot.schemeTotals);
  if (
    Object.hasOwn(schemeTotals, schemeSlug) &&
    schemeTotals[schemeSlug] !== currentScheme?.totalLakhs
  ) {
    diffs.push({
      field: 'amount',
      before: schemeTotals[schemeSlug],
      after: currentScheme?.totalLakhs ?? null,
    });
  }

  const deadlines = record(snapshot.deadlines);
  if (
    Object.hasOwn(deadlines, schemeSlug) &&
    deadlines[schemeSlug] !== currentScheme?.deadline
  ) {
    diffs.push({
      field: 'deadline',
      before: deadlines[schemeSlug],
      after: currentScheme?.deadline ?? null,
    });
  }

  const previousNextAction = recordOrNull(snapshot.nextAction);
  const next = current.sequence[0];
  const currentNextAction =
    next === undefined
      ? null
      : {
          title: next.title,
          organisation: next.organisation,
          schemeIds: next.schemeIds,
        };
  if (
    previousNextAction !== null &&
    JSON.stringify(previousNextAction) !== JSON.stringify(currentNextAction)
  ) {
    diffs.push({
      field: 'next_action',
      before: previousNextAction,
      after: currentNextAction,
    });
  }
  return diffs;
}

export function describeProjectImpact(
  schemeSlug: string,
  diffs: readonly ProjectImpactDiff[],
  citationUrl: string,
): string {
  const details = diffs.map((diff) => {
    if (diff.field === 'eligibility') {
      return `eligibility changed from ${String(diff.before)} to ${String(diff.after)}`;
    }
    if (diff.field === 'amount') {
      return `computed amount changed from ₹${String(diff.before)} lakh to ₹${String(diff.after)} lakh`;
    }
    if (diff.field === 'deadline') {
      return `deadline changed from ${String(diff.before)} to ${String(diff.after)}`;
    }
    return 'the first recommended next action changed';
  });
  return `Verified ${schemeSlug} change affects this saved project: ${details.join('; ')}. Evidence: ${citationUrl}`;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function recordOrNull(value: unknown): Record<string, unknown> | null {
  const parsed = record(value);
  return Object.keys(parsed).length === 0 ? null : parsed;
}

function stringArray(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}
