import { expect, test } from '@playwright/test';

import type { MatcherInput, RulesetVersion } from '@nilam/engine';

import engineCases from '../../apps/web/lib/fixtures/nilam-engine-cases.json';
import { serializeMatcherState } from '../../apps/web/lib/matcher-state';

test.use({ viewport: { width: 390, height: 844 } });

test('Matcher restores, recomputes and shares its URL profile', async ({
  page,
}) => {
  const fixture = engineCases.find(({ name }) => name === 'manufacturing');
  if (fixture === undefined) throw new Error('Missing manufacturing fixture');
  const initialInput = {
    ...fixture.input,
    firstGeneration: false,
  } as MatcherInput;
  const query = serializeMatcherState({
    input: initialInput,
    ruleset: fixture.expected.ruleset as RulesetVersion,
  });

  await page.goto(`/?${query}`);

  await expect(
    page.getByRole('button', { name: 'Textiles', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('District')).toHaveValue('Chennai');
  expect(
    Number(
      await page.getByRole('slider', { name: 'Project size' }).inputValue(),
    ),
  ).toBeCloseTo(
    (100 * Math.log(initialInput.projectCostLakhs / 10)) / Math.log(500),
    0,
  );
  await expect(page.getByText('NEEDS', { exact: true })).toHaveCount(0);
  const firstGeneration = page.getByRole('button', {
    name: /First-generation entrepreneur/u,
  });
  await expect(firstGeneration).toHaveAttribute('aria-pressed', 'false');
  await expect(page).toHaveURL(
    new RegExp(`\\?${query.replaceAll('?', '\\?')}$`, 'u'),
  );

  await firstGeneration.click();
  await expect(firstGeneration).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('NEEDS', { exact: true })).toBeVisible();
  const recomputedQuery = serializeMatcherState({
    input: fixture.input as MatcherInput,
    ruleset: fixture.expected.ruleset as RulesetVersion,
  });
  await expect(page).toHaveURL(
    new RegExp(`\\?${recomputedQuery.replaceAll('?', '\\?')}$`, 'u'),
  );
  await expect(
    page.getByText(`₹${fixture.expected.totalLakhs}L`, { exact: true }).first(),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Share result' }).click();
  await expect(
    page.getByRole('button', { name: 'Link copied ✓' }),
  ).toBeVisible();
});

test('land contract distinguishes verified PostGIS from safe fallback', async ({
  request,
}) => {
  const response = await request.get(
    '/api/land?district=Coimbatore&status=unknown',
  );
  expect(response.ok()).toBe(true);
  const body = (await response.json()) as {
    type: string;
    mode: 'postgis' | 'fallback';
    features: Array<{
      properties: { status: string; dataQuality: string };
    }>;
  };
  expect(body.type).toBe('FeatureCollection');

  if (body.mode === 'fallback') {
    expect(
      body.features.every(
        ({ properties }) =>
          properties.status === 'unknown' &&
          properties.dataQuality === 'directory-only',
      ),
    ).toBe(true);
  } else {
    expect(
      body.features.every(
        ({ properties }) => properties.dataQuality === 'verified-plot',
      ),
    ).toBe(true);
  }
});

test('removed and unknown browser routes redirect home', async ({
  page,
  request,
}) => {
  const removedRoutes = [
    '/land?district=Coimbatore',
    '/estates/guindy-industrial-estate',
    '/schemes/tn-capital-subsidy',
    '/schemes/district/chennai',
    '/schemes/sector/manufacturing',
    '/playbooks/industrial-land-shortlist',
    '/methodology',
    '/sources',
    '/changelog',
    '/definitely-not-a-page',
  ];

  for (const route of removedRoutes) {
    await page.goto(route);
    await expect.poll(() => new URL(page.url()).pathname).toBe('/');
    await expect(
      page.getByRole('button', { name: 'Land Explorer', exact: true }).first(),
    ).toBeVisible();
  }

  const unknownApi = await request.get('/api/definitely-not-an-endpoint');
  expect(unknownApi.status()).toBe(404);
});
