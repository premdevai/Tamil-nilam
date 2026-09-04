import { expect, test } from '@playwright/test';

import { signInAs } from './helpers';

test('sign-in page requires consent before sending a magic link', async ({
  page,
}) => {
  await page.goto('/account/sign-in');
  await expect(
    page.getByRole('heading', { name: 'Sign in without a password' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Email me a secure link' }),
  ).toBeDisabled();
  await page.getByLabel('Email address').fill('user@example.com');
  await page.getByRole('checkbox').check();
  await expect(
    page.getByRole('button', { name: 'Email me a secure link' }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Email me a secure link' }).click();
  await expect(page).toHaveURL(/\/account\/verify/);
  await expect(
    page.getByRole('link', { name: 'Continue on this device' }),
  ).toBeVisible();
});

test('share cards render an image for a Matcher profile', async ({
  request,
}) => {
  const response = await request.get(
    '/api/share-card?district=Chennai&cost=50&capital=40',
  );
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type'] ?? '').toMatch(/image\//);
});

test('Telegram linking issues a deep link after login', async ({ page }) => {
  test.skip(
    !(await signInAs(page, 'user')),
    'E2E session helper is locked unless E2E_AUTH_SECRET and Postgres are available.',
  );
  await page.goto('/account');
  await expect(
    page.getByRole('heading', { name: 'Saved work and alerts' }),
  ).toBeVisible();
  let responseBody: { url?: string } | undefined;
  await page.route('**/api/account/telegram-link', async (route) => {
    const response = await route.fetch();
    responseBody = (await response.json()) as { url?: string };
    await route.fulfill({ response });
  });
  await page.route('https://t.me/**', (route) => route.abort());
  await page.getByRole('button', { name: /Telegram/ }).click();
  await expect
    .poll(() => responseBody?.url)
    .toMatch(/t\.me\/NilamLocalBot\?start=nilam_link_/);
});
