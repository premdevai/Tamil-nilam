import { expect, test } from '@playwright/test';

const MATCHER_FIXTURE =
  '/?sector=food-processing&cost=110&capital=17.6&machinery=17.6&loan=71.5&district=Thanjavur&locationClass=rural&backward=1&firstgen=1';

test('rich Matcher keeps the canonical desktop composition', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile-chromium',
    'The canonical screenshot is a desktop-only regression.',
  );
  await page.setViewportSize({ width: 1024, height: 576 });
  await page.goto(MATCHER_FIXTURE);
  await page.evaluate(() => {
    document
      .querySelectorAll('nextjs-portal')
      .forEach((portal) => portal.remove());
  });
  await expect(
    page.getByRole('heading', {
      name: 'Cited schemes and TANSIDCO plots, one computed answer.',
    }),
  ).toBeVisible();
  await expect(page).toHaveScreenshot('rich-matcher-1024x576.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.03,
  });
});

test('Matcher controls remain functional without mobile overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(MATCHER_FIXTURE);

  await page
    .getByRole('button', { name: /First-generation entrepreneur/ })
    .click();
  await expect(page).toHaveURL(/firstgen=0/);
  await expect(page.getByText('NEEDS', { exact: true })).toHaveCount(0);

  const viewport = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(viewport.scrollWidth).toBe(viewport.clientWidth);
});
