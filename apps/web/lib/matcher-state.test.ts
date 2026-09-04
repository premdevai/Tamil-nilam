import { describe, expect, it } from 'vitest';

import {
  DEFAULT_MATCHER_INPUT,
  parseMatcherState,
  serializeMatcherState,
} from './matcher-state';

describe('matcher URL state', () => {
  it('parses compact share fields and preserves a pinned ruleset', () => {
    const state = parseMatcherState({
      sector: 'food-processing',
      district: 'Madurai',
      cost: '40',
      capital: '25',
      machinery: '20',
      loan: '18',
      firstgen: '0',
      ruleset: '2025.03',
      estate: 'example-estate',
    });

    expect(state.input).toMatchObject({
      sector: 'food-processing',
      district: 'Madurai',
      projectCostLakhs: 40,
      eligibleCapitalCostLakhs: 25,
      firstGeneration: false,
    });
    expect(state.ruleset).toBe('2025.03');
    expect(state.estate).toBe('example-estate');
  });

  it('canonicalizes TANSIDCO snapshot district spellings', () => {
    expect(parseMatcherState({ district: 'Trichy' }).input.district).toBe(
      'Tiruchirappalli',
    );
    expect(parseMatcherState({ district: 'Kanchipuram' }).input.district).toBe(
      'Kancheepuram',
    );
  });

  it('falls back atomically when a shared profile violates the closed schema', () => {
    const state = parseMatcherState({
      cost: '10',
      capital: '20',
      district: 'Not a district',
    });

    expect(state.input).toEqual(DEFAULT_MATCHER_INPUT);
  });

  it('round-trips a valid profile without serializing every default', () => {
    const query = serializeMatcherState({
      input: { ...DEFAULT_MATCHER_INPUT, district: 'Chennai', age: 42 },
      ruleset: '2026.08',
    });
    const state = parseMatcherState(
      Object.fromEntries(new URLSearchParams(query).entries()),
    );

    expect(state.input.district).toBe('Chennai');
    expect(state.input.age).toBe(42);
    expect(query).not.toContain('sector=');
  });
});
