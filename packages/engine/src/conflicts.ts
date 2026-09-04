import type {
  CompatibilityResult,
  ConflictPair,
  ConflictResolution,
  PublishedSchemeRule,
  SchemeResult,
} from './types';

export interface ConflictOutcome {
  readonly kept: readonly SchemeResult[];
  readonly conflicts: readonly ConflictResolution[];
  readonly compatibility: readonly CompatibilityResult[];
}

const pairKey = (schemeA: string, schemeB: string): string =>
  [schemeA, schemeB].sort().join('::');

const resultWinner = (
  left: SchemeResult,
  right: SchemeResult,
): { kept: SchemeResult; dropped: SchemeResult } => {
  if (left.totalLakhs !== right.totalLakhs) {
    return left.totalLakhs > right.totalLakhs
      ? { kept: left, dropped: right }
      : { kept: right, dropped: left };
  }
  return left.schemeId.localeCompare(right.schemeId) <= 0
    ? { kept: left, dropped: right }
    : { kept: right, dropped: left };
};

export function resolveConflicts(
  candidates: readonly SchemeResult[],
  rules: readonly PublishedSchemeRule[],
  conflictPairs: readonly ConflictPair[],
): ConflictOutcome {
  const rulesById = new Map(rules.map((rule) => [rule.id, rule]));
  const explicitPairs = new Map(
    conflictPairs.map((pair) => [pairKey(pair.schemeA, pair.schemeB), pair]),
  );
  const conflicts: ConflictResolution[] = [];
  const keptById = new Map(
    candidates.map((candidate) => [candidate.schemeId, candidate]),
  );

  const grouped = new Map<string, SchemeResult[]>();
  for (const candidate of candidates) {
    const group = rulesById.get(candidate.schemeId)?.conflictGroup;
    if (group === undefined) {
      continue;
    }
    const members = grouped.get(group) ?? [];
    members.push(candidate);
    grouped.set(group, members);
  }

  for (const [group, members] of [...grouped].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const ranked = [...members].sort(
      (a, b) =>
        b.totalLakhs - a.totalLakhs || a.schemeId.localeCompare(b.schemeId),
    );
    const winner = ranked[0];
    if (winner === undefined) {
      continue;
    }
    for (const dropped of ranked.slice(1)) {
      keptById.delete(dropped.schemeId);
      const citationIds = [
        ...(rulesById.get(winner.schemeId)?.citations.map(({ id }) => id) ??
          []),
        ...(rulesById.get(dropped.schemeId)?.citations.map(({ id }) => id) ??
          []),
      ];
      conflicts.push({
        keptSchemeId: winner.schemeId,
        droppedSchemeId: dropped.schemeId,
        kind: 'conflict-group',
        rationale: `Both rules are in ${group}; the deterministic policy keeps the larger calculated benefit. This policy is inferred and requires written authority confirmation.`,
        confirmedAt: 'inferred',
        citationIds: [...new Set(citationIds)].sort(),
      });
    }
  }

  for (const pair of [...conflictPairs].sort((a, b) =>
    pairKey(a.schemeA, a.schemeB).localeCompare(pairKey(b.schemeA, b.schemeB)),
  )) {
    if (pair.kind !== 'exclusive') {
      continue;
    }
    const left = keptById.get(pair.schemeA);
    const right = keptById.get(pair.schemeB);
    if (left === undefined || right === undefined) {
      continue;
    }
    const { kept, dropped } = resultWinner(left, right);
    keptById.delete(dropped.schemeId);
    conflicts.push({
      keptSchemeId: kept.schemeId,
      droppedSchemeId: dropped.schemeId,
      kind: 'exclusive-pair',
      rationale: pair.rationale,
      confirmedAt: pair.confirmedAt,
      citationIds: pair.citationIds,
    });
  }

  const kept = [...keptById.values()].sort((a, b) =>
    a.schemeId.localeCompare(b.schemeId),
  );
  const compatibility: CompatibilityResult[] = [];
  for (let leftIndex = 0; leftIndex < kept.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < kept.length;
      rightIndex += 1
    ) {
      const left = kept[leftIndex];
      const right = kept[rightIndex];
      if (left === undefined || right === undefined) {
        continue;
      }
      const pair = explicitPairs.get(pairKey(left.schemeId, right.schemeId));
      compatibility.push({
        schemeA: left.schemeId,
        schemeB: right.schemeId,
        kind:
          pair?.kind === 'compatible' || pair?.kind === 'caution'
            ? pair.kind
            : 'unknown',
        rationale:
          pair?.rationale ??
          'No verified pairwise compatibility evidence is in this ruleset; confirm in writing before relying on the stack.',
        confirmedAt: pair?.confirmedAt ?? 'inferred',
        citationIds: pair?.citationIds ?? [],
      });
    }
  }

  return {
    kept,
    conflicts: conflicts.sort(
      (a, b) =>
        a.keptSchemeId.localeCompare(b.keptSchemeId) ||
        a.droppedSchemeId.localeCompare(b.droppedSchemeId),
    ),
    compatibility,
  };
}
