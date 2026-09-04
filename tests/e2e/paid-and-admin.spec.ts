import { expect, test } from '@playwright/test';

import { signInAs } from './helpers';

test('fake gateway purchase then queues a DPR', async ({ page }) => {
  test.skip(
    !(await signInAs(page, 'user')),
    'E2E session helper is locked unless E2E_AUTH_SECRET and Postgres are available.',
  );
  await page.goto('/account/billing');
  await expect(page.getByRole('heading', { name: 'Paid plans' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).first().click();
  await expect(page.getByRole('status')).toContainText(
    'Test payment captured. Entitlements are active.',
  );

  await page.goto('/account/dpr');
  await page.getByLabel('Business name').fill('Kaveri Foods');
  await page.getByLabel('Promoter name').fill('A. Selvi');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Queue Word and PDF' }).click();
  await expect(page.getByRole('status')).toContainText(/DPR queued/);
});

test('admin review console is role-gated', async ({ page }) => {
  test.skip(
    !(await signInAs(page, 'user')),
    'E2E session helper is locked unless E2E_AUTH_SECRET and Postgres are available.',
  );
  await page.goto('/admin');
  await expect(page).toHaveURL(/account/);

  const adminReady = await signInAs(page, 'admin');
  test.skip(!adminReady, 'Could not mint an admin E2E session.');
  await page.goto('/admin');
  await expect(
    page.getByRole('heading', { name: 'Evidence operations' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Review queue' }),
  ).toBeVisible();
});
