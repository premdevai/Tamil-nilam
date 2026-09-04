import { existsSync } from 'node:fs';
import path from 'node:path';
import { loadEnvFile } from 'node:process';

import { defineConfig, devices } from '@playwright/test';

if (existsSync('.env')) loadEnvFile('.env');

const e2eAuthSecret =
  process.env.E2E_AUTH_SECRET !== undefined &&
  process.env.E2E_AUTH_SECRET.length >= 16
    ? process.env.E2E_AUTH_SECRET
    : 'nilam-e2e-session-secret';
process.env.E2E_AUTH_SECRET = e2eAuthSecret;

const documentStorageDir = path.resolve(
  process.cwd(),
  process.env.DOCUMENT_STORAGE_DIR ?? '.data/documents',
);
const port = Number(process.env.E2E_PORT ?? 3000);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: {
    command: `pnpm --filter @nilam/web exec next dev --turbopack --port ${port}`,
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ??
        'postgresql://nilam:nilam@localhost:5432/nilam',
      MEILI_HOST: process.env.MEILI_HOST ?? 'http://localhost:7700',
      MEILI_MASTER_KEY: process.env.MEILI_MASTER_KEY ?? 'local-development-key',
      NEXT_PUBLIC_SITE_URL: baseURL,
      AUTH_SECRET:
        process.env.AUTH_SECRET ?? 'nilam-e2e-auth-secret-change-me-32ch',
      PAYMENT_GATEWAY_MODE: process.env.PAYMENT_GATEWAY_MODE ?? 'fake',
      FAKE_PAYMENT_SECRET:
        process.env.FAKE_PAYMENT_SECRET ?? 'nilam-safe-fake-payment-secret',
      TELEGRAM_BOT_USERNAME:
        process.env.TELEGRAM_BOT_USERNAME ?? 'NilamLocalBot',
      DOCUMENT_STORAGE_DIR: documentStorageDir,
      NEXT_DIST_DIR: process.env.NEXT_DIST_DIR ?? `.next/e2e-${String(port)}`,
      RAZORPAY_ALLOW_LIVE: 'false',
      E2E_AUTH_SECRET: e2eAuthSecret,
    },
    reuseExistingServer: !process.env.CI,
    url: `${baseURL}/api/health`,
  },
});
