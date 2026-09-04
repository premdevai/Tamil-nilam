import { expect, test } from '@playwright/test';

test('serves the public Matcher and health endpoint', async ({
  page,
  request,
}) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', {
      name: 'Cited schemes and TANSIDCO plots, one computed answer.',
    }),
  ).toBeVisible();
  await expect(page.getByText('நிலம்', { exact: true }).first()).toBeVisible();

  const health = await request.get('/api/health');

  expect(health.ok()).toBe(true);
  await expect(health.json()).resolves.toMatchObject({
    service: 'nilam-web',
    status: 'ok',
  });
});
