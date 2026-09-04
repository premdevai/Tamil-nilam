import { z } from 'zod';

import { authorizeRequest } from '../../../../../lib/authz';
import {
  downloadQueryAuthorized,
  signedDownloadQuery,
  storedDocumentResponse,
} from '../../../../../lib/document-download';
import { getDatabase } from '../../../../../lib/db';

const formatSchema = z.enum(['pdf', 'docx']);

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const url = new URL(request.url);
  const formatParse = formatSchema.safeParse(
    url.searchParams.get('format') ?? 'pdf',
  );
  if (!formatParse.success) {
    return Response.json({ error: 'invalid_format' }, { status: 400 });
  }
  const pool = getDatabase().pool;
  const result = await pool.query<{
    userId: string;
    status: string;
    pdfStorageKey: string | null;
    docxStorageKey: string | null;
    expiresAt: Date | null;
  }>(
    `select user_id::text as "userId", status,
       pdf_storage_key as "pdfStorageKey",
       docx_storage_key as "docxStorageKey",
       expires_at as "expiresAt"
     from generated_dprs where id = $1::uuid`,
    [id],
  );
  const dpr = result.rows[0];
  if (dpr === undefined) {
    return Response.json({ error: 'dpr_not_found' }, { status: 404 });
  }
  const signedFormat = downloadQueryAuthorized({
    userId: dpr.userId,
    documentId: id,
    format: url.searchParams.get('format'),
    exp: url.searchParams.get('exp'),
    sig: url.searchParams.get('sig'),
  });
  if (signedFormat === undefined) {
    const authorization = await authorizeRequest('account:read');
    if (!authorization.ok) return authorization.response;
    if (authorization.session.user.id !== dpr.userId) {
      return Response.json({ error: 'forbidden' }, { status: 403 });
    }
  }
  if (dpr.status !== 'ready') {
    return Response.json(
      { error: 'document_not_ready', status: dpr.status },
      { status: 409 },
    );
  }
  const format = signedFormat ?? formatParse.data;
  return storedDocumentResponse({
    storageKey: format === 'pdf' ? dpr.pdfStorageKey : dpr.docxStorageKey,
    format,
    filename: `nilam-dpr-${id.slice(0, 8)}.${format}`,
    expiresAt: dpr.expiresAt,
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authorization = await authorizeRequest('account:read');
  if (!authorization.ok) return authorization.response;
  const { id } = await context.params;
  const parsed = z
    .object({ format: z.enum(['pdf', 'docx']).default('pdf') })
    .safeParse(await request.json().catch(() => ({ format: 'pdf' })));
  if (!parsed.success) {
    return Response.json({ error: 'invalid_format' }, { status: 400 });
  }
  const dpr = await getDatabase().pool.query<{ userId: string }>(
    `select user_id::text as "userId" from generated_dprs
     where id = $1::uuid and user_id = $2::uuid`,
    [id, authorization.session.user.id],
  );
  if (dpr.rows[0] === undefined) {
    return Response.json({ error: 'dpr_not_found' }, { status: 404 });
  }
  return Response.json(
    signedDownloadQuery({
      userId: authorization.session.user.id,
      documentId: id,
      format: parsed.data.format,
    }),
  );
}
