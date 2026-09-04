import { describe, expect, it } from 'vitest';

import { DEFAULT_MATCHER_INPUT } from './matcher-state';
import { evaluateMatcherSurface } from './matcher-surfaces';
import {
  buildApplicationPackets,
  companionFromPackets,
} from './application-packets';

describe('application packets', () => {
  it('separates calculated schemes from official doors and never invents cash', () => {
    const result = evaluateMatcherSurface(DEFAULT_MATCHER_INPUT, '2026.08');
    const packets = buildApplicationPackets(result);
    expect(packets.some((packet) => packet.schemeId === 'needs')).toBe(true);
    expect(
      packets.some((packet) => packet.schemeId === 'tn-capital-subsidy'),
    ).toBe(true);
    expect(packets.some((packet) => packet.schemeId === 'tansidco-plot')).toBe(
      true,
    );
    expect(
      packets
        .filter((packet) => packet.kind === 'official-door')
        .every((packet) => packet.cashLakhs === 0),
    ).toBe(true);
    const companion = companionFromPackets(packets);
    expect(companion.tasks.length).toBe(packets.length);
    expect(companion.readiness?.documents.length).toBeGreaterThan(0);
  });
});
