import { readFile } from 'node:fs/promises';

import {
  DOCUMENT_DOWNLOAD_TTL_SECONDS,
  createDownloadSignature,
  verifyDownloadSignature,
  type DownloadFormat,
} from '@nilam/paid';
import { resolveStoredDocumentPath } from '@nilam/paid/documents';

export function downloadSigningSecret(
  environment: NodeJS.ProcessEnv = process.env,
): string {
  const configured = environment.DOWNLOAD_SIGNING_SECRET;
  if (configured !== undefined && configured.length >= 32) return configured;
  if (environment.NODE_ENV === 'production') {
    throw new Error('DOWNLOAD_SIGNING_SECRET is required in production.');
  }
  return 'nilam-local-download-signing-secret-change-me';
}

export function signedDownloadQuery(input: {
  userId: string;
  documentId: string;
  format: DownloadFormat;
  now?: Date;
}): { exp: string; sig: string; format: DownloadFormat } {
  const expiresAt =
    Math.floor((input.now ?? new Date()).getTime() / 1000) +
    DOCUMENT_DOWNLOAD_TTL_SECONDS;
  return {
    format: input.format,
    exp: String(expiresAt),
    sig: createDownloadSignature(
      {
        userId: input.userId,
        documentId: input.documentId,
        format: input.format,
        expiresAt,
      },
      downloadSigningSecret(),
    ),
  };
}

export function downloadQueryAuthorized(input: {
  userId: string;
  documentId: string;
  format: string | null;
  exp: string | null;
  sig: string | null;
  now?: Date;
}): DownloadFormat | undefined {
  if (input.format !== 'pdf' && input.format !== 'docx') return undefined;
  if (input.exp === null || input.sig === null) return undefined;
  const expiresAt = Number(input.exp);
  if (!Number.isFinite(expiresAt)) return undefined;
  const valid = verifyDownloadSignature(
    {
      userId: input.userId,
      documentId: input.documentId,
      format: input.format,
      expiresAt,
    },
    input.sig,
    downloadSigningSecret(),
    input.now,
  );
  return valid ? input.format : undefined;
}

export async function storedDocumentResponse(input: {
  storageKey: string | null;
  format: DownloadFormat;
  filename: string;
  expiresAt: Date | null;
}): Promise<Response> {
  if (input.storageKey === null) {
    return Response.json({ error: 'document_not_ready' }, { status: 409 });
  }
  if (input.expiresAt !== null && input.expiresAt.getTime() <= Date.now()) {
    return Response.json({ error: 'download_expired' }, { status: 410 });
  }
  const bytes = await readFile(resolveStoredDocumentPath(input.storageKey));
  return new Response(bytes, {
    headers: {
      'content-type':
        input.format === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'content-disposition': `attachment; filename="${input.filename}"`,
      'cache-control': 'private, no-store',
    },
  });
}
