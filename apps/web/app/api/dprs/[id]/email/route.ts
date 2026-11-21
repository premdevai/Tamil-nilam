import { readFile } from 'node:fs/promises';

import { dprSnapshotSchema } from '@nilam/paid';
import { resolveStoredDocumentPath } from '@nilam/paid/documents';

import { authorizeRequest } from '../../../../../lib/authz';
import { getDatabase } from '../../../../../lib/db';
import {
  DPR_EMAILS_PER_DAY,
  composeDprMail,
  dprEmailRequestSchema,
  sendDprMail,
} from '../../../../../lib/dpr-mail';

/** Email a ready DPR (PDF + Word attached) to a bank, DIC or the founder. */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authorization = await authorizeRequest('account:write');
  if (!authorization.ok) return authorization.response;
  const userId = authorization.session.user.id;
  const { id } = await context.params;

  const parsed = dprEmailRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json(
      {
        error: 'invalid_email_request',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  const pool = getDatabase().pool;
  const found = await pool.query<{
    status: string;
    inputSnapshot: unknown;
    pdfStorageKey: string | null;
    docxStorageKey: string | null;
    expiresAt: Date | null;
  }>(
    `select status, input_snapshot as "inputSnapshot",
       pdf_storage_key as "pdfStorageKey", docx_storage_key as "docxStorageKey",
       expires_at as "expiresAt"
     from generated_dprs where id = $1::uuid and user_id = $2::uuid`,
    [id, userId],
  );
  const dpr = found.rows[0];
  if (dpr === undefined) {
    return Response.json({ error: 'dpr_not_found' }, { status: 404 });
  }
  if (
    dpr.status !== 'ready' ||
    dpr.pdfStorageKey === null ||
    dpr.docxStorageKey === null
  ) {
    return Response.json(
      { error: 'document_not_ready', status: dpr.status },
      { status: 409 },
    );
  }
  if (dpr.expiresAt !== null && dpr.expiresAt.getTime() <= Date.now()) {
    return Response.json({ error: 'download_expired' }, { status: 410 });
  }

  const sentToday = await pool.query<{ count: string }>(
    `select count(*)::text as count from audit_records
     where actor_id = $1::uuid and action = 'dpr.emailed'
       and created_at > now() - interval '1 day'`,
    [userId],
  );
  if (Number(sentToday.rows[0]?.count ?? 0) >= DPR_EMAILS_PER_DAY) {
    return Response.json(
      { error: 'email_limit_reached', limitPerDay: DPR_EMAILS_PER_DAY },
      { status: 429 },
    );
  }

  const snapshot = dprSnapshotSchema.parse(dpr.inputSnapshot);
  const slug = snapshot.input.businessName
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '')
    .slice(0, 60);
  const [pdf, docx] = await Promise.all([
    readFile(resolveStoredDocumentPath(dpr.pdfStorageKey)),
    readFile(resolveStoredDocumentPath(dpr.docxStorageKey)),
  ]);
  const mail = composeDprMail({
    dpr: snapshot.input,
    request: parsed.data,
    senderEmail: authorization.session.user.email ?? undefined,
    attachments: [
      {
        filename: `DPR-${slug || 'project'}.pdf`,
        content: pdf,
        contentType: 'application/pdf',
      },
      {
        filename: `DPR-${slug || 'project'}.docx`,
        content: docx,
        contentType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      },
    ],
  });

  try {
    const sent = await sendDprMail(mail);
    await pool.query(
      `insert into audit_records
         (actor_id, action, target_type, target_id, metadata)
       values ($1::uuid, 'dpr.emailed', 'generated_dpr', $2,
         jsonb_build_object('recipients', $3::int, 'transport', $4::text))`,
      [userId, id, mail.to.length + mail.cc.length, sent.transport],
    );
    return Response.json({
      sent: true,
      transport: sent.transport,
      to: mail.to,
      cc: mail.cc,
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'dpr.email_failed',
        dprId: id,
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    return Response.json({ error: 'email_failed' }, { status: 502 });
  }
}
