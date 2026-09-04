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
  page,
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

  await page.goto('/land?district=Coimbatore');
  await page.getByRole('button', { name: 'Apply filters' }).click();

  if (body.mode === 'fallback') {
    expect(
      body.features.every(
        ({ properties }) =>
          properties.status === 'unknown' &&
          properties.dataQuality === 'directory-only',
      ),
    ).toBe(true);
    await expect(
      page.getByText('Safe fallback · availability unknown'),
    ).toBeVisible();
  } else {
    expect(
      body.features.every(
        ({ properties }) => properties.dataQuality === 'verified-plot',
      ),
    ).toBe(true);
    await expect(page.getByText('PostGIS verified records')).toBeVisible();
  }
});

test('TANSIDCO estate pages cite the vacancy snapshot', async ({ page }) => {
  await page.goto('/estates/guindy-industrial-estate');
  await expect(
    page.getByRole('heading', { name: 'Guindy', exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/19 vacant on chart/)).toBeVisible();
  await expect(page.getByText(/TANSIDCO vacancy snapshot/)).toBeVisible();
});

test('pending schemes and anonymous playbook progress are explicit', async ({
  page,
}) => {
  await page.goto('/schemes/tn-capital-subsidy');
  await expect(
    page.getByText('Pending verification — not calculated'),
  ).toBeVisible();
  await expect(
    page.getByText(/No eligibility decision or monetary benefit/),
  ).toBeVisible();

  await page.goto('/playbooks/industrial-land-shortlist');
  const firstStep = page.getByRole('checkbox').first();
  await firstStep.check();
  await page.reload();
  await expect(page.getByRole('checkbox').first()).toBeChecked();
});
