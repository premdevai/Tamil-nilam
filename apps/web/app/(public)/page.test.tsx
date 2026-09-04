// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const homeMode = vi.hoisted(() => ({
  value: 'rich' as 'rich' | 'safe',
}));

vi.mock('../../components/matcher-target', () => ({
  Matcher: ({ initialInput }: { initialInput: { district: string } }) => (
    <div data-testid="safe-home">{initialInput.district}</div>
  ),
}));

vi.mock('../../components/nilam-app', () => ({
  NilamApp: ({ initialInput }: { initialInput: { district: string } }) => (
    <div data-testid="rich-home">{initialInput.district}</div>
  ),
}));

vi.mock('../../components/public-shell', () => ({
  JsonLd: () => null,
}));

vi.mock('../../lib/env', () => ({
  resolveNilamHomeMode: () => homeMode.value,
}));

import MatcherPage from './page';

afterEach(() => {
  cleanup();
  homeMode.value = 'rich';
});

describe('home rollback mode', () => {
  it('renders the rich engine-backed home by default', async () => {
    render(
      await MatcherPage({
        searchParams: Promise.resolve({ district: 'Chennai' }),
      }),
    );

    expect(screen.getByTestId('rich-home')).toHaveTextContent('Chennai');
    expect(screen.queryByTestId('safe-home')).not.toBeInTheDocument();
  });

  it('rolls back to the verified safe matcher with the same query state', async () => {
    homeMode.value = 'safe';

    render(
      await MatcherPage({
        searchParams: Promise.resolve({ district: 'Erode' }),
      }),
    );

    expect(screen.getByTestId('safe-home')).toHaveTextContent('Erode');
    expect(screen.queryByTestId('rich-home')).not.toBeInTheDocument();
  });
});
