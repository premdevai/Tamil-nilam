// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import engineCases from '../lib/fixtures/nilam-engine-cases.json';
import { DEFAULT_MATCHER_INPUT } from '../lib/matcher-state';
import { Matcher } from './matcher-target';

describe('safe Matcher', () => {
  it('renders the engine fixture and keeps canonical URL state', async () => {
    const fixture = engineCases.find(({ name }) => name === 'default');
    expect(fixture).toBeDefined();

    render(
      <Matcher initialInput={DEFAULT_MATCHER_INPUT} initialRuleset="2026.08" />,
    );

    expect(screen.getByText('Total computed support')).toBeInTheDocument();
    expect(
      screen.getAllByText(`₹${fixture?.expected.totalLakhs}L`),
    ).not.toHaveLength(0);
    expect(
      screen.getByRole('heading', {
        name: `Your scheme stack · ${fixture?.expected.eligible.length} schemes`,
      }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('District · மாவட்டம்'), {
      target: { value: 'Chennai' },
    });

    await waitFor(() => {
      expect(window.location.search).toContain('district=Chennai');
    });
  });
});
