import { describe, expect, it } from 'vitest';

import {
  CURRENT_RULESET,
  evaluate,
  generateApplicationSequence,
  type PublishedSchemeRule,
} from '../src';
import { baseInput } from './fixtures';

describe('application sequencing', () => {
  it('deduplicates shared steps and respects prerequisites', () => {
    const result = evaluate(baseInput, CURRENT_RULESET, {
      asOf: '2026-08-21',
    });
    const ids = result.sequence.map(({ id }) => id);

    expect(ids.filter((id) => id === 'udyam-registration')).toHaveLength(1);
    expect(ids.indexOf('needs-apply')).toBeLessThan(
      ids.indexOf('needs-bank-sanction'),
    );
    expect(ids.indexOf('udyam-registration')).toBeLessThan(
      ids.indexOf('cgtmse-request'),
    );
    expect(result.sequence.map(({ order }) => order)).toEqual(
      result.sequence.map((_, index) => index + 1),
    );
  });

  it('fails deterministically on dependency cycles', () => {
    const template = CURRENT_RULESET.records.find(
      (record): record is PublishedSchemeRule =>
        record.status === 'published' && record.id === 'needs',
    );
    expect(template).toBeDefined();
    if (template === undefined) {
      throw new Error('Template rule missing');
    }
    const ruleA: PublishedSchemeRule = {
      ...template,
      id: 'cycle-a',
      steps: [
        {
          id: 'cycle-step-a',
          title: 'Cycle A',
          organisation: 'Test',
          citationIds: [template.citations[0]?.id ?? 'missing'],
          requires: ['cycle-step-b'],
        },
      ],
    };
    const ruleB: PublishedSchemeRule = {
      ...template,
      id: 'cycle-b',
      steps: [
        {
          id: 'cycle-step-b',
          title: 'Cycle B',
          organisation: 'Test',
          citationIds: [template.citations[0]?.id ?? 'missing'],
          requires: ['cycle-step-a'],
        },
      ],
    };

    expect(() => generateApplicationSequence([ruleB, ruleA])).toThrow(
      /dependency cycle: cycle-step-a, cycle-step-b/u,
    );
  });
});
