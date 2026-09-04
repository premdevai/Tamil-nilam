import { createHmac, randomUUID } from 'node:crypto';
import { access } from 'node:fs/promises';
import path from 'node:path';

import {
  expect,
  request as playwrightRequest,
  test,
  type Page,
} from '@playwright/test';
import { Pool } from 'pg';

import { signInAs } from './helpers';

const databaseUrl =
  process.env.DATABASE_URL ?? 'postgresql://nilam:nilam@127.0.0.1:5432/nilam';
const baseURL = `http://127.0.0.1:${process.env.E2E_PORT ?? '3000'}`;

test('saved stacks and playbook progress persist and merge', async ({
  page,
}) => {
  test.skip(
    test.info().project.name !== 'chromium',
    'API-only state workflow runs once in the desktop project.',
  );
  const email = `saves-${randomUUID()}@e2e.nilam.test`;
  expect(await signInAs(page, 'user', email)).toBe(true);
  const resultHash = randomUUID().replaceAll('-', '');
  const stack = {
    name: 'Audit stack',
    inputs: { district: 'Thanjavur', sector: 'food-processing' },
    resultSnapshot: { eligibleSchemeSlugs: ['needs'] },
    resultHash,
    rulesetVersion: 'tn-2026',
  };

  const created = await page.request.post('/api/account/saved-stacks', {
    data: stack,
  });
  expect(created.status()).toBe(201);
  const replayed = await page.request.post('/api/account/saved-stacks', {
    data: { ...stack, name: 'Updated audit stack' },
  });
  expect(replayed.status()).toBe(201);
  const saved = await page.request.get('/api/account/saved-stacks');
  expect(saved.ok()).toBe(true);
  await expect(saved.json()).resolves.toMatchObject({
    savedStacks: [
      expect.objectContaining({
        name: 'Updated audit stack',
        resultHash,
      }),
    ],
  });

  const firstProgress = await page.request.put(
    '/api/account/playbooks/industrial-land-shortlist',
    { data: { completed: [0] } },
  );
  await expect(firstProgress.json()).resolves.toEqual({ completed: [0] });
  const mergedProgress = await page.request.put(
    '/api/account/playbooks/industrial-land-shortlist',
    { data: { completed: [1] } },
  );
  await expect(mergedProgress.json()).resolves.toEqual({ completed: [0, 1] });
});

test('checkout replay, webhooks, grace and consultant bulk flow work', async ({
  page,
}) => {
  test.skip(
    test.info().project.name !== 'chromium',
    'API-only billing workflow runs once in the desktop project.',
  );
  test.setTimeout(120_000);
  const email = `consultant-${randomUUID()}@e2e.nilam.test`;
  expect(await signInAs(page, 'consultant', email)).toBe(true);
  const idempotencyKey = `consultant-${randomUUID()}`;
  const checkout = await page.request.post('/api/payments/checkout', {
    data: { plan: 'consultant', idempotencyKey },
  });
  expect(checkout.status()).toBe(201);
  const payment = (await checkout.json()) as {
    paymentId: string;
    providerSubscriptionId: string;
  };
  const replay = await page.request.post('/api/payments/checkout', {
    data: { plan: 'consultant', idempotencyKey },
  });
  await expect(replay.json()).resolves.toMatchObject({
    paymentId: payment.paymentId,
    replayed: true,
  });
  const completed = await page.request.post('/api/payments/fake-complete', {
    data: { paymentId: payment.paymentId },
  });
  expect(completed.ok()).toBe(true);

  const client = await page.request.post('/api/clients', {
    data: {
      name: 'Audit client',
      contactEmail: 'client@example.test',
    },
  });
  expect(client.status()).toBe(201);
  const { id: clientWorkspaceId } = (await client.json()) as { id: string };
  const profile = await page.request.post('/api/profiles', {
    data: {
      name: 'Audit business profile',
      clientWorkspaceId,
      profile: {
        businessName: 'Audit Foods',
        promoterName: 'Audit Promoter',
        sector: 'Food processing',
        district: 'Thanjavur',
        entityKind: 'proprietorship',
        notes: 'E2E-only profile',
      },
    },
  });
  expect(profile.status()).toBe(201);

  const bulk = await page.request.post('/api/bulk-runs', {
    data: {
      csv: [
        'businessName,sector,district,projectCost',
        'Audit Foods,manufacturing,Thanjavur,25',
      ].join('\n'),
      idempotencyKey: `bulk-${randomUUID()}`,
      clientWorkspaceId,
    },
  });
  expect(bulk.status()).toBe(202);
  const { id: bulkRunId } = (await bulk.json()) as { id: string };
  await expect
    .poll(
      async () => {
        const response = await page.request.get(`/api/bulk-runs/${bulkRunId}`);
        return ((await response.json()) as { status: string }).status;
      },
      { timeout: 90_000 },
    )
    .toBe('ready');

  const pendingEvent = {
    id: `evt_pending_${randomUUID()}`,
    event: 'subscription.pending',
    created_at: Math.floor(Date.now() / 1000) + 10,
    payload: {
      subscription: {
        entity: {
          id: payment.providerSubscriptionId,
          current_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        },
      },
    },
  };
  const eventId = `delivery-${randomUUID()}`;
  const pending = await postWebhook(page, eventId, pendingEvent);
  expect(pending.ok()).toBe(true);
  const webhookReplay = await postWebhook(page, eventId, pendingEvent);
  await expect(webhookReplay.json()).resolves.toMatchObject({
    received: true,
    replayed: true,
  });
  const mismatch = await postWebhook(page, eventId, {
    ...pendingEvent,
    event: 'subscription.halted',
  });
  expect(mismatch.status()).toBe(409);

  const billing = await page.request.get('/api/billing');
  const billingBody = (await billing.json()) as {
    subscriptions: Array<{
      status: string;
      gracePeriodEnd: string | null;
    }>;
  };
  expect(billingBody.subscriptions[0]).toMatchObject({
    status: 'past_due',
  });
  expect(billingBody.subscriptions[0]?.gracePeriodEnd).not.toBeNull();
  expect((await page.request.get('/api/clients')).ok()).toBe(true);

  const expired = await postWebhook(page, `expired-${randomUUID()}`, {
    id: `evt_expired_${randomUUID()}`,
    event: 'subscription.completed',
    created_at: Math.floor(Date.now() / 1000) + 20,
    payload: {
      subscription: {
        entity: { id: payment.providerSubscriptionId },
      },
    },
  });
  expect(expired.ok()).toBe(true);
  expect((await page.request.get('/api/clients')).status()).toBe(402);
});

test('DPR generation, signed download, export and deletion clean up', async ({
  browser,
  page,
}) => {
  test.skip(
    test.info().project.name !== 'chromium',
    'API-only document workflow runs once in the desktop project.',
  );
  test.setTimeout(150_000);
  const email = `delete-${randomUUID()}@e2e.nilam.test`;
  expect(await signInAs(page, 'user', email)).toBe(true);
  const checkout = await page.request.post('/api/payments/checkout', {
    data: {
      plan: 'dpr_once',
      idempotencyKey: `dpr-payment-${randomUUID()}`,
    },
  });
  const { paymentId } = (await checkout.json()) as { paymentId: string };
  expect(
    (
      await page.request.post('/api/payments/fake-complete', {
        data: { paymentId },
      })
    ).ok(),
  ).toBe(true);

  const queued = await page.request.post('/api/dprs', {
    data: {
      idempotencyKey: `dpr-${randomUUID()}`,
      input: {
        businessName: 'Kaveri Audit Foods',
        promoterName: 'Audit Promoter',
        sector: 'Food processing',
        district: 'Thanjavur',
        projectCost: 1_000_000,
        landAndBuildingCost: 200_000,
        plantAndMachineryCost: 500_000,
        otherFixedCost: 100_000,
        workingCapital: 200_000,
        promoterContribution: 250_000,
        termLoan: 750_000,
        otherFunding: 0,
        projectedAnnualRevenue: 1_500_000,
        projectedAnnualOperatingCost: 1_100_000,
        employment: 12,
        implementationMonths: 8,
        assumptions: ['E2E-only planning assumption.'],
        citations: [
          {
            title: 'E2E fixture source',
            url: 'https://example.com/e2e-source',
            verifiedOn: '2026-08-20',
          },
        ],
      },
    },
  });
  expect(queued.status()).toBe(202);
  const { id: dprId } = (await queued.json()) as { id: string };
  await expect
    .poll(
      async () => {
        const response = await page.request.get('/api/dprs');
        const body = (await response.json()) as {
          dprs: Array<{ id: string; status: string }>;
        };
        return body.dprs.find((item) => item.id === dprId)?.status;
      },
      { timeout: 120_000 },
    )
    .toBe('ready');

  const ownerDownload = await page.request.get(
    `/api/dprs/${dprId}/download?format=pdf`,
  );
  expect(ownerDownload.ok()).toBe(true);
  expect(ownerDownload.headers()['content-type']).toContain('application/pdf');
  const signed = await page.request.post(`/api/dprs/${dprId}/download`, {
    data: { format: 'pdf' },
  });
  const signedQuery = (await signed.json()) as {
    format: string;
    exp: string;
    sig: string;
  };
  const anonymous = await playwrightRequest.newContext({ baseURL });
  const signedDownload = await anonymous.get(
    `/api/dprs/${dprId}/download?${new URLSearchParams(signedQuery)}`,
  );
  expect(signedDownload.ok()).toBe(true);
  const tampered = await anonymous.get(
    `/api/dprs/${dprId}/download?${new URLSearchParams({
      ...signedQuery,
      exp: String(Number(signedQuery.exp) - 1),
    })}`,
  );
  expect(tampered.status()).toBe(401);
  await anonymous.dispose();

  const otherPage = await browser.newPage();
  expect(
    await signInAs(otherPage, 'user', `other-${randomUUID()}@e2e.nilam.test`),
  ).toBe(true);
  expect(
    (
      await otherPage.request.get(`/api/dprs/${dprId}/download?format=pdf`)
    ).status(),
  ).toBe(403);
  await otherPage.close();

  const exported = await page.request.post('/api/account/export');
  expect(exported.ok()).toBe(true);
  await expect(exported.json()).resolves.toMatchObject({
    format: 'nilam-account-export-v1',
  });

  const pool = new Pool({ connectionString: databaseUrl });
  const document = await pool.query<{
    userId: string;
    pdfStorageKey: string;
    docxStorageKey: string;
  }>(
    `select user_id::text as "userId", pdf_storage_key as "pdfStorageKey",
       docx_storage_key as "docxStorageKey"
     from generated_dprs where id = $1::uuid`,
    [dprId],
  );
  const record = document.rows[0];
  expect(record).toBeDefined();
  const storageKeys = [record?.pdfStorageKey, record?.docxStorageKey].filter(
    (value): value is string => value !== undefined,
  );
  for (const key of storageKeys) {
    await expect(
      access(path.resolve('.data/documents', key)),
    ).resolves.toBeUndefined();
  }

  const deletion = await page.request.post('/api/account/deletion', {
    data: { confirmation: 'DELETE' },
  });
  expect(deletion.status()).toBe(202);
  const { id: deletionId } = (await deletion.json()) as { id: string };
  await expect
    .poll(
      async () => {
        const result = await pool.query<{ status: string }>(
          'select status from account_data_requests where id = $1::uuid',
          [deletionId],
        );
        return result.rows[0]?.status;
      },
      { timeout: 120_000 },
    )
    .toBe('completed');
  const deletedUser = await pool.query<{
    deletedAt: Date | null;
    email: string;
  }>(`select deleted_at as "deletedAt", email from users where id = $1::uuid`, [
    record?.userId,
  ]);
  expect(deletedUser.rows[0]?.deletedAt).not.toBeNull();
  expect(deletedUser.rows[0]?.email).toMatch(/^deleted\+/);
  for (const key of storageKeys) {
    await expect(
      access(path.resolve('.data/documents', key)),
    ).rejects.toThrow();
  }
  expect((await page.request.get('/api/account/saved-stacks')).status()).toBe(
    401,
  );
  await pool.end();
});

test('review, publication and corrective versions enforce roles', async ({
  page,
}) => {
  test.skip(
    test.info().project.name !== 'chromium',
    'API-only publication workflow runs once in the desktop project.',
  );
  const pool = new Pool({ connectionString: databaseUrl });
  const fixtureKey = `audit-test-${randomUUID()}`;
  const snapshot = await pool.query<{ id: string }>(
    `insert into staging.raw_source_snapshots
       (connector, source_url, content_hash, payload, raw_body, mime_type)
     values ('e2e-audit', 'https://example.com/e2e-source', $1,
       '{}'::jsonb, '\\x00'::bytea, 'application/json')
     returning id::text`,
    [randomUUID().replaceAll('-', '')],
  );
  const review = await pool.query<{ id: string }>(
    `insert into staging.review_queue
       (snapshot_id, entity_type, entity_key, proposed_data, field_diff,
        source_url, content_hash)
     select $1::uuid, 'audit_test', $2, $3::jsonb, '[]'::jsonb,
       source_url, content_hash
     from staging.raw_source_snapshots where id = $1::uuid
     returning id::text`,
    [
      snapshot.rows[0]?.id,
      fixtureKey,
      JSON.stringify({ summary: 'E2E-only publication fixture' }),
    ],
  );
  const reviewId = review.rows[0]?.id;
  expect(reviewId).toBeDefined();

  expect(
    await signInAs(page, 'user', `user-${randomUUID()}@e2e.nilam.test`),
  ).toBe(true);
  expect(
    (
      await page.request.patch(`/api/admin/reviews/${reviewId}`, {
        data: { status: 'approved', note: 'E2E approval audit note' },
      })
    ).status(),
  ).toBe(403);

  expect(
    await signInAs(page, 'reviewer', `reviewer-${randomUUID()}@e2e.nilam.test`),
  ).toBe(true);
  const approved = await page.request.patch(`/api/admin/reviews/${reviewId}`, {
    data: {
      status: 'approved',
      note: 'E2E approval audit note',
      reviewedData: { summary: 'Reviewed E2E-only publication fixture' },
    },
  });
  expect(approved.ok()).toBe(true);
  expect(
    (await page.request.post(`/api/admin/publish/${reviewId}`)).status(),
  ).toBe(403);

  expect(
    await signInAs(page, 'admin', `admin-${randomUUID()}@e2e.nilam.test`),
  ).toBe(true);
  const published = await page.request.post(`/api/admin/publish/${reviewId}`);
  expect(published.status()).toBe(201);
  const publication = (await published.json()) as {
    id: string;
    version: number;
  };
  expect(publication.version).toBe(1);

  expect(
    await signInAs(
      page,
      'reviewer',
      `reviewer-correction-${randomUUID()}@e2e.nilam.test`,
    ),
  ).toBe(true);
  const correction = await page.request.post('/api/admin/corrective-versions', {
    data: {
      publicationId: publication.id,
      reason: 'E2E corrective version verifies append-only publication.',
      proposedData: {
        summary: 'Corrected E2E-only publication fixture',
      },
    },
  });
  expect(correction.status()).toBe(201);
  const { id: correctionId } = (await correction.json()) as { id: string };

  expect(
    await signInAs(
      page,
      'admin',
      `admin-correction-${randomUUID()}@e2e.nilam.test`,
    ),
  ).toBe(true);
  const corrected = await page.request.post(
    `/api/admin/corrective-versions/${correctionId}/publish`,
  );
  expect(corrected.status()).toBe(201);
  await expect(corrected.json()).resolves.toMatchObject({ version: 2 });
  const versions = await pool.query<{ count: string }>(
    `select count(*)::text as count from publication_versions
     where entity_type = 'audit_test' and entity_key = $1`,
    [fixtureKey],
  );
  expect(Number(versions.rows[0]?.count)).toBe(2);
  await pool.end();
});

async function postWebhook(
  page: Page,
  eventId: string,
  payload: Record<string, unknown>,
) {
  const rawBody = JSON.stringify(payload);
  const signature = createHmac(
    'sha256',
    process.env.FAKE_PAYMENT_SECRET ?? 'nilam-safe-fake-payment-secret',
  )
    .update(rawBody)
    .digest('hex');
  return page.request.post('/api/payments/webhook', {
    headers: {
      'content-type': 'application/json',
      'x-razorpay-event-id': eventId,
      'x-razorpay-signature': signature,
    },
    data: rawBody,
  });
}
