import type {
  ApplicationStep,
  ApplicationStepDefinition,
  PublishedSchemeRule,
} from './types';

interface MutableStep {
  definition: ApplicationStepDefinition;
  schemeIds: Set<string>;
}

export function generateApplicationSequence(
  rules: readonly PublishedSchemeRule[],
): readonly ApplicationStep[] {
  const byId = new Map<string, MutableStep>();

  for (const rule of [...rules].sort((a, b) => a.id.localeCompare(b.id))) {
    for (const step of rule.steps) {
      const existing = byId.get(step.id);
      if (existing === undefined) {
        byId.set(step.id, {
          definition: step,
          schemeIds: new Set([rule.id]),
        });
        continue;
      }

      if (
        existing.definition.title !== step.title ||
        existing.definition.organisation !== step.organisation
      ) {
        throw new Error(`Conflicting definitions for sequence step ${step.id}`);
      }
      existing.schemeIds.add(rule.id);
    }
  }

  const indegree = new Map<string, number>();
  const dependents = new Map<string, Set<string>>();
  for (const [id, step] of byId) {
    const presentRequirements = step.definition.requires.filter((requiredId) =>
      byId.has(requiredId),
    );
    indegree.set(id, new Set(presentRequirements).size);
    for (const requiredId of presentRequirements) {
      const downstream = dependents.get(requiredId) ?? new Set<string>();
      downstream.add(id);
      dependents.set(requiredId, downstream);
    }
  }

  const ready = [...byId.keys()].filter((id) => indegree.get(id) === 0).sort();
  const orderedIds: string[] = [];

  while (ready.length > 0) {
    const id = ready.shift();
    if (id === undefined) {
      break;
    }
    orderedIds.push(id);

    for (const dependent of [...(dependents.get(id) ?? [])].sort()) {
      const nextIndegree = (indegree.get(dependent) ?? 0) - 1;
      indegree.set(dependent, nextIndegree);
      if (nextIndegree === 0) {
        ready.push(dependent);
        ready.sort();
      }
    }
  }

  if (orderedIds.length !== byId.size) {
    const cyclicIds = [...byId.keys()]
      .filter((id) => !orderedIds.includes(id))
      .sort();
    throw new Error(
      `Application sequence contains a dependency cycle: ${cyclicIds.join(', ')}`,
    );
  }

  return orderedIds.map((id, index) => {
    const step = byId.get(id);
    if (step === undefined) {
      throw new Error(`Missing sequence step ${id}`);
    }
    return {
      ...step.definition,
      schemeIds: [...step.schemeIds].sort(),
      order: index + 1,
    };
  });
}
