import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';
import { Pool } from 'pg';

import { signInAs } from './helpers';

const databaseUrl =
  process.env.DATABASE_URL ?? 'postgresql://nilam:nilam@127.0.0.1:5432/nilam';

test('project companion slices preserve evidence and ownership', async ({
  page,
}) => {
  test.skip(
    test.info().project.name !== 'chromium',
    'Stateful companion workflow runs once.',
  );
  const email = `companion-${randomUUID()}@e2e.nilam.test`;
  expect(await signInAs(page, 'user', email)).toBe(true);
  const saved = await page.request.post('/api/account/saved-stacks', {
    data: {
      name: 'Companion E2E project',
      inputs: canonicalInput,
      resultSnapshot: {},
      resultHash: randomUUID().replaceAll('-', ''),
      rulesetVersion: '2026.08',
    },
  });
  expect(saved.status()).toBe(201);
  const project = (await saved.json()) as {
    id: string;
    projectUrl: string;
  };
  await page.goto(project.projectUrl);
  await expect(
    page.getByRole('heading', { name: 'Companion E2E project' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Application packets' }),
  ).toBeVisible();
  await expect(page.getByText('Official apply').first()).toBeVisible();

  expect(
    (
      await page.request.put(`/api/account/projects/${project.id}/decision`, {
        data: {
          decision: 'pursue',
          reason: 'The cited support justifies preparing the application.',
        },
      })
    ).ok(),
  ).toBe(true);

  const readiness = await page.request.put(
    `/api/account/projects/${project.id}/readiness`,
    {
      data: {
        profileFacts: {
          businessName: 'Companion Foods',
          promoterName: 'E2E Promoter',
        },
        documents: [
          {
            key: 'udyam',
            label: 'Udyam registration',
            required: true,
            status: 'ready',
            expiresOn: null,
            evidenceUrl: 'https://udyamregistration.gov.in/e2e-proof',
          },
        ],
        blockers: [],
        confirmedAssumptions: assumptionFields,
      },
    },
  );
  expect(readiness.ok()).toBe(true);
  await expect(readiness.json()).resolves.toMatchObject({
    applicationReady: true,
  });

  const createdTask = await page.request.post(
    `/api/account/projects/${project.id}/tasks`,
    {
      data: {
        title: 'Submit verified application',
        owner: 'Founder',
        reason: 'First action in the canonical application sequence.',
        deadlineOn: null,
        officialUrl: 'https://example.gov.in/apply',
        applicationId: '',
        followUpOn: null,
      },
    },
  );
  expect(createdTask.status()).toBe(201);
  const task = (await createdTask.json()) as { id: string };
  expect(
    (
      await page.request.patch(
        `/api/account/projects/${project.id}/tasks/${task.id}`,
        { data: { completed: true } },
      )
    ).status(),
  ).toBe(400);

  expect(
    await signInAs(page, 'user', `other-${randomUUID()}@e2e.nilam.test`),
  ).toBe(true);
  expect(
    (
      await page.request.patch(
        `/api/account/projects/${project.id}/tasks/${task.id}`,
        {
          data: {
            completed: true,
            proofUrl: 'https://example.gov.in/receipt/forbidden',
          },
        },
      )
    ).status(),
  ).toBe(404);

  expect(await signInAs(page, 'user', email)).toBe(true);
  expect(
    (
      await page.request.patch(
        `/api/account/projects/${project.id}/tasks/${task.id}`,
        {
          data: {
            completed: true,
            proofUrl: 'https://example.gov.in/receipt/owned',
            applicationId: 'APP-E2E-1',
          },
        },
      )
    ).ok(),
  ).toBe(true);

  expect(
    (
      await page.request.post(`/api/account/projects/${project.id}/outcomes`, {
        data: {
          status: 'submitted',
          officialReference: 'APP-E2E-1',
          recordedOn: '2026-08-22',
          evidenceUrl: 'https://example.gov.in/receipt/owned',
          note: '',
          rejectionReason: '',
        },
      })
    ).status(),
  ).toBe(201);
  expect(
    (
      await page.request.post(`/api/account/projects/${project.id}/outcomes`, {
        data: {
          status: 'rejected',
          officialReference: 'ORDER-E2E-1',
          recordedOn: '2026-08-22',
          evidenceUrl: 'https://example.gov.in/order/rejected',
          note: '',
          rejectionReason: '',
        },
      })
    ).status(),
  ).toBe(400);

  const pool = new Pool({ connectionString: databaseUrl });
  const milestones = await pool.query<{ action: string }>(
    `select action from audit_records
     where target_type = 'saved_stack' and target_id = $1
       and action like 'milestone.%'`,
    [project.id],
  );
  expect(milestones.rows.map((row) => row.action)).toEqual(
    expect.arrayContaining([
      'milestone.qualified_project_created',
      'milestone.pursue_skip_decision',
      'milestone.assumption_confirmed',
      'milestone.application_ready',
      'milestone.first_next_action_completed',
      'milestone.submitted',
    ]),
  );
  await pool.end();
});

const canonicalInput = {
  sector: 'food-processing',
  projectCostLakhs: 110,
  eligibleCapitalCostLakhs: 17.6,
  eligiblePlantMachineryLakhs: 17.6,
  requestedLoanLakhs: 71.5,
  district: 'Thanjavur',
  locationClass: 'rural',
  backwardBlock: true,
  firstGeneration: true,
  age: 30,
  specialCategory: 'none',
  fpoWilling: false,
  entityKind: 'proprietorship',
  enterpriseStage: 'new',
  enterpriseSize: 'micro',
  educationLevel: 'twelfth',
  annualFamilyIncomeLakhs: 5,
  priorGovernmentCapitalSubsidy: false,
  repaidMudraTarun: false,
  udyamRegistered: false,
};

const assumptionFields = [
  'eligibleCapitalCostLakhs',
  'eligiblePlantMachineryLakhs',
  'requestedLoanLakhs',
  'age',
  'specialCategory',
  'locationClass',
  'entityKind',
  'enterpriseStage',
  'enterpriseSize',
  'educationLevel',
  'annualFamilyIncomeLakhs',
  'priorGovernmentCapitalSubsidy',
  'repaidMudraTarun',
  'udyamRegistered',
];
