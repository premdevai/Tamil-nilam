import { expect, type APIRequestContext, type Page } from '@playwright/test';

export async function e2eSessionAvailable(
  request: APIRequestContext,
): Promise<boolean> {
  const response = await request.post('/api/e2e/session', {
    headers: { 'x-e2e-secret': process.env.E2E_AUTH_SECRET ?? '' },
    data: { role: 'user' },
  });
  return response.ok();
}

export async function signInAs(
  page: Page,
  role: 'user' | 'consultant' | 'reviewer' | 'admin',
  email?: string,
): Promise<boolean> {
  const response = await page.request.post('/api/e2e/session', {
    headers: { 'x-e2e-secret': process.env.E2E_AUTH_SECRET ?? '' },
    data: { role, ...(email === undefined ? {} : { email }) },
  });
  if (!response.ok()) return false;
  await expect(response.json()).resolves.toMatchObject({ ok: true, role });
  return true;
}
