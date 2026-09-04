import type { Metadata } from 'next';

import { Matcher as SafeMatcher } from '../../components/matcher-target';
import { NilamApp } from '../../components/nilam-app';
import { JsonLd } from '../../components/public-shell';
import { resolveNilamHomeMode } from '../../lib/env';
import { parseMatcherState } from '../../lib/matcher-state';
import { SITE_URL } from '../../lib/public-data';

export const metadata: Metadata = {
  title: 'Scheme Matcher',
  description:
    'Match a Tamil Nadu enterprise profile against cited, versioned government scheme rules.',
  alternates: { canonical: '/' },
};

export default async function MatcherPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const state = parseMatcherState(await searchParams);
  const safeMode = resolveNilamHomeMode() === 'safe';

  return (
    <>
      <JsonLd
        value={{
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: 'NILAM Scheme Matcher',
          applicationCategory: 'BusinessApplication',
          operatingSystem: 'Web',
          url: SITE_URL,
          inLanguage: ['en-IN', 'ta-IN'],
          description:
            'A versioned, evidence-led government scheme matcher for Tamil Nadu enterprises.',
        }}
      />
      {safeMode ? (
        <SafeMatcher
          initialInput={state.input}
          initialRuleset={state.ruleset}
          projectMemoryEnabled
          {...(state.estate === undefined
            ? {}
            : { initialEstate: state.estate })}
        />
      ) : (
        <NilamApp
          initialInput={state.input}
          initialRuleset={state.ruleset}
          projectMemoryEnabled
        />
      )}
    </>
  );
}
