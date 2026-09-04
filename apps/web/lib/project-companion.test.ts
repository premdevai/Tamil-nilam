import { describe, expect, it } from 'vitest';

import {
  calculateApplicationReady,
  completeProjectTask,
  outcomeSchema,
  type ProjectTask,
} from './project-companion';

describe('project companion state', () => {
  it('requires confirmed assumptions and unexpired document evidence', () => {
    const base = {
      profileFacts: { businessName: 'Kaveri Foods' },
      blockers: [],
      confirmedAssumptions: ['age'],
      documents: [
        {
          key: 'udyam',
          label: 'Udyam registration',
          required: true,
          status: 'ready' as const,
          expiresOn: null,
          evidenceUrl: 'https://udyamregistration.gov.in/evidence',
        },
      ],
    };
    expect(calculateApplicationReady(base, ['age'], '2026-08-22')).toBe(true);
    expect(
      calculateApplicationReady(
        {
          ...base,
          documents: base.documents.map((document) => ({
            ...document,
            expiresOn: '2026-08-21',
          })),
        },
        ['age'],
        '2026-08-22',
      ),
    ).toBe(false);
    expect(
      calculateApplicationReady(base, ['age', 'enterpriseSize'], '2026-08-22'),
    ).toBe(false);
  });

  it('refuses task completion without proof and keeps query evidence', () => {
    const task: ProjectTask = {
      id: 'task-1',
      title: 'Submit',
      owner: 'Founder',
      reason: 'Verified next action',
      deadlineOn: null,
      officialUrl: 'https://example.gov.in/apply',
      applicationId: '',
      followUpOn: null,
      proofUrl: '',
      completedAt: null,
      queryLog: [],
      createdAt: '2026-08-22T00:00:00.000Z',
    };
    expect(() => completeProjectTask(task, { completed: true })).toThrow(
      'completion_proof_required',
    );
    expect(
      completeProjectTask(
        task,
        {
          completed: true,
          proofUrl: 'https://example.gov.in/receipt/1',
          query: {
            note: 'Clarification requested.',
            evidenceUrl: 'https://example.gov.in/query/1',
          },
        },
        '2026-08-22T01:00:00.000Z',
      ),
    ).toMatchObject({
      completedAt: '2026-08-22T01:00:00.000Z',
      queryLog: [{ note: 'Clarification requested.' }],
    });
  });

  it('requires an evidence URL and reason for rejection', () => {
    const base = {
      status: 'rejected' as const,
      officialReference: 'APP-1',
      recordedOn: '2026-08-22',
      evidenceUrl: 'https://example.gov.in/orders/1',
      note: '',
      rejectionReason: '',
    };
    expect(outcomeSchema.safeParse(base).success).toBe(false);
    expect(
      outcomeSchema.safeParse({
        ...base,
        rejectionReason: 'Entity type is outside the notified category.',
      }).success,
    ).toBe(true);
  });
});
