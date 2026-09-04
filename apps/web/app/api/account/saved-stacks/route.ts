import { createHash } from 'node:crypto';

import { auditRecords, savedStacks } from '@nilam/db';
import { MatcherInputSchema, getRuleset } from '@nilam/engine';
import { FREE_SAVED_STACK_LIMIT } from '@nilam/paid';
import { and, count, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import {
  buildApplicationPackets,
  companionFromPackets,
} from '../../../../lib/application-packets';
import { authorizeRequest } from '../../../../lib/authz';
import { getDatabase } from '../../../../lib/db';
import {
  evaluateMatcherSurface,
  prepareSavedStackSnapshot,
} from '../../../../lib/matcher-surfaces';
import { hasEntitlement } from '../../../../lib/paid-access';
import {
  projectSnapshotWithCompanion,
  recordProjectMilestone,
} from '../../../../lib/project-memory';

const savedStackSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    inputs: z.record(z.string(), z.unknown()),
    resultSnapshot: z.record(z.string(), z.unknown()).default({}),
    resultHash: z.string().min(8).max(128),
    rulesetVersion: z.string().min(1).max(40),
  })
  .strict();

export async function GET() {
  const authorization = await authorizeRequest('account:read');
  if (!authorization.ok) return authorization.response;
  const records = await getDatabase()
    .db.select()
    .from(savedStacks)
    .where(eq(savedStacks.userId, authorization.session.user.id))
    .orderBy(desc(savedStacks.createdAt));
  return Response.json({ savedStacks: records });
}

export async function POST(request: Request) {
  const authorization = await authorizeRequest('saves:write');
  if (!authorization.ok) return authorization.response;
  const parsed = savedStackSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json({ error: 'invalid_saved_stack' }, { status: 400 });
  }

  const databaseConnection = getDatabase();
  const database = databaseConnection.db;
  const userId = authorization.session.user.id;
  const canonicalInput = MatcherInputSchema.safeParse(parsed.data.inputs);
  let values = parsed.data;
  let qualified = false;
  if (canonicalInput.success) {
    try {
      getRuleset(parsed.data.rulesetVersion);
      const evaluation = evaluateMatcherSurface(
        canonicalInput.data,
        parsed.data.rulesetVersion,
      );
      const resultSnapshot = projectSnapshotWithCompanion(
        prepareSavedStackSnapshot(evaluation),
        companionFromPackets(buildApplicationPackets(evaluation)),
      );
      values = {
        ...parsed.data,
        inputs: canonicalInput.data,
        resultSnapshot,
        resultHash: createHash('sha256')
          .update(
            JSON.stringify({
              input: canonicalInput.data,
              rulesetVersion: evaluation.rulesetVersion,
            }),
          )
          .digest('hex'),
        rulesetVersion: evaluation.rulesetVersion,
      };
      qualified = evaluation.eligible.length > 0;
    } catch {
      return Response.json({ error: 'invalid_ruleset' }, { status: 400 });
    }
  }
  const existing = await database
    .select({ id: savedStacks.id })
    .from(savedStacks)
    .where(
      and(
        eq(savedStacks.userId, userId),
        eq(savedStacks.resultHash, values.resultHash),
      ),
    )
    .limit(1);
  if (existing.length === 0) {
    const unlimited = await hasEntitlement(userId, 'saves:unlimited');
    if (!unlimited) {
      const [total] = await database
        .select({ value: count() })
        .from(savedStacks)
        .where(eq(savedStacks.userId, userId));
      if (Number(total?.value ?? 0) >= FREE_SAVED_STACK_LIMIT) {
        return Response.json(
          {
            error: 'saved_stack_limit',
            limit: FREE_SAVED_STACK_LIMIT,
            message:
              'Free accounts can keep five saved stacks. Pro unlocks unlimited saves.',
          },
          { status: 402 },
        );
      }
    }
  }
  const [record] = await database
    .insert(savedStacks)
    .values({ userId, ...values })
    .onConflictDoUpdate({
      target: [savedStacks.userId, savedStacks.resultHash],
      set: {
        name: values.name,
        inputs: values.inputs,
        resultSnapshot: sql`${JSON.stringify(values.resultSnapshot)}::jsonb ||
          jsonb_build_object(
            'project',
            coalesce(${savedStacks.resultSnapshot} -> 'project', '{}'::jsonb)
          )`,
        rulesetVersion: values.rulesetVersion,
        updatedAt: new Date(),
      },
    })
    .returning();
  if (record === undefined) {
    throw new Error('Failed to save stack');
  }
  await database.insert(auditRecords).values({
    actorId: userId,
    action: 'saved_stack.saved',
    targetType: 'saved_stack',
    targetId: record.id,
  });
  if (existing.length === 0 && qualified) {
    await recordProjectMilestone(
      databaseConnection.pool.query.bind(databaseConnection.pool),
      {
        userId,
        projectId: record.id,
        kind: 'qualified_project_created',
        metadata: { rulesetVersion: record.rulesetVersion },
      },
    );
  }
  return Response.json(
    { ...record, projectUrl: `/account/projects/${record.id}` },
    { status: 201 },
  );
}
