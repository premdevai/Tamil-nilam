import { z } from 'zod';

const isoDate = z.iso.date();
const optionalUrl = z.union([z.literal(''), z.url()]).optional();

export const projectDecisionSchema = z
  .object({
    decision: z.enum(['pursue', 'skip']),
    reason: z.string().trim().min(1).max(500),
  })
  .strict();

export const readinessDocumentSchema = z
  .object({
    key: z.string().trim().min(1).max(80),
    label: z.string().trim().min(1).max(160),
    required: z.boolean(),
    status: z.enum(['missing', 'ready']),
    expiresOn: isoDate.nullable().default(null),
    evidenceUrl: optionalUrl,
  })
  .strict();

export const readinessSchema = z
  .object({
    profileFacts: z
      .record(
        z.string().trim().min(1).max(80),
        z.union([z.string().trim().max(500), z.number().finite(), z.boolean()]),
      )
      .default({}),
    documents: z.array(readinessDocumentSchema).max(100).default([]),
    blockers: z.array(z.string().trim().min(1).max(500)).max(30).default([]),
    confirmedAssumptions: z
      .array(z.string().trim().min(1).max(80))
      .max(100)
      .default([]),
  })
  .strict();

export const executionTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    owner: z.string().trim().min(1).max(120),
    reason: z.string().trim().min(1).max(500),
    deadlineOn: isoDate.nullable().default(null),
    officialUrl: z.url(),
    applicationId: z.string().trim().max(120).default(''),
    followUpOn: isoDate.nullable().default(null),
  })
  .strict();

export const taskUpdateSchema = z
  .object({
    completed: z.boolean().optional(),
    proofUrl: optionalUrl,
    applicationId: z.string().trim().max(120).optional(),
    followUpOn: isoDate.nullable().optional(),
    query: z
      .object({
        note: z.string().trim().min(1).max(1_000),
        evidenceUrl: z.url(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const outcomeSchema = z
  .object({
    status: z.enum([
      'submitted',
      'queried',
      'sanctioned',
      'allotted',
      'claimed',
      'rejected',
    ]),
    officialReference: z.string().trim().min(1).max(160),
    recordedOn: isoDate,
    evidenceUrl: z.url(),
    note: z.string().trim().max(1_000).default(''),
    rejectionReason: z.string().trim().max(500).default(''),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.status === 'rejected' && value.rejectionReason.length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['rejectionReason'],
        message: 'A valid rejection reason is required.',
      });
    }
  });

export type ProjectDecision = z.infer<typeof projectDecisionSchema>;
export type ProjectReadinessInput = z.infer<typeof readinessSchema>;
export type ExecutionTaskInput = z.infer<typeof executionTaskSchema>;
export type TaskUpdate = z.infer<typeof taskUpdateSchema>;
export type ProjectOutcomeInput = z.infer<typeof outcomeSchema>;

export type ProjectTask = ExecutionTaskInput & {
  readonly id: string;
  readonly proofUrl: string;
  readonly completedAt: string | null;
  readonly queryLog: readonly {
    at: string;
    note: string;
    evidenceUrl: string;
  }[];
  readonly createdAt: string;
};

export type ProjectOutcome = ProjectOutcomeInput & {
  readonly id: string;
  readonly createdAt: string;
};

export type ProjectReadiness = ProjectReadinessInput & {
  readonly applicationReady: boolean;
  readonly updatedAt: string;
};

export type ProjectCompanion = {
  readonly decision?: ProjectDecision & { readonly decidedAt: string };
  readonly readiness?: ProjectReadiness;
  readonly tasks: readonly ProjectTask[];
  readonly outcomes: readonly ProjectOutcome[];
};

const storedDecisionSchema = projectDecisionSchema.and(
  z.object({ decidedAt: z.iso.datetime() }),
);
const storedReadinessSchema = readinessSchema.and(
  z.object({
    applicationReady: z.boolean(),
    updatedAt: z.iso.datetime(),
  }),
);
const storedTaskSchema = executionTaskSchema.and(
  z.object({
    id: z.uuid(),
    proofUrl: z.union([z.literal(''), z.url()]),
    completedAt: z.iso.datetime().nullable(),
    queryLog: z.array(
      z.object({
        at: z.iso.datetime(),
        note: z.string(),
        evidenceUrl: z.url(),
      }),
    ),
    createdAt: z.iso.datetime(),
  }),
);
const storedOutcomeSchema = outcomeSchema.and(
  z.object({ id: z.uuid(), createdAt: z.iso.datetime() }),
);

export function emptyProjectCompanion(): ProjectCompanion {
  return { tasks: [], outcomes: [] };
}

export function parseProjectCompanion(
  resultSnapshot: Record<string, unknown>,
): ProjectCompanion {
  const raw =
    typeof resultSnapshot.project === 'object' &&
    resultSnapshot.project !== null &&
    !Array.isArray(resultSnapshot.project)
      ? (resultSnapshot.project as Record<string, unknown>)
      : {};
  const decision = storedDecisionSchema.safeParse(raw.decision);
  const readiness = storedReadinessSchema.safeParse(raw.readiness);
  const tasks = z.array(storedTaskSchema).safeParse(raw.tasks);
  const outcomes = z.array(storedOutcomeSchema).safeParse(raw.outcomes);
  return {
    ...(decision.success ? { decision: decision.data } : {}),
    ...(readiness.success ? { readiness: readiness.data } : {}),
    tasks: tasks.success ? tasks.data : [],
    outcomes: outcomes.success ? outcomes.data : [],
  };
}

export function calculateApplicationReady(
  input: ProjectReadinessInput,
  requiredAssumptions: readonly string[],
  today = new Date().toISOString().slice(0, 10),
): boolean {
  const confirmed = new Set(input.confirmedAssumptions);
  const required = input.documents.filter((document) => document.required);
  return (
    input.blockers.length === 0 &&
    requiredAssumptions.every((field) => confirmed.has(field)) &&
    required.length > 0 &&
    required.every(
      (document) =>
        document.status === 'ready' &&
        document.evidenceUrl !== undefined &&
        document.evidenceUrl !== '' &&
        (document.expiresOn === null || document.expiresOn >= today),
    )
  );
}

export function completeProjectTask(
  task: ProjectTask,
  update: TaskUpdate,
  now = new Date().toISOString(),
): ProjectTask {
  const proofUrl = update.proofUrl ?? task.proofUrl;
  if (update.completed === true && proofUrl === '') {
    throw new Error('completion_proof_required');
  }
  const queryLog =
    update.query === undefined
      ? task.queryLog
      : [
          ...task.queryLog,
          {
            at: now,
            note: update.query.note,
            evidenceUrl: update.query.evidenceUrl,
          },
        ];
  return {
    ...task,
    proofUrl,
    applicationId: update.applicationId ?? task.applicationId,
    followUpOn:
      update.followUpOn === undefined ? task.followUpOn : update.followUpOn,
    completedAt:
      update.completed === undefined
        ? task.completedAt
        : update.completed
          ? now
          : null,
    queryLog,
  };
}
