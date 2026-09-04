import { createHmac, timingSafeEqual } from 'node:crypto';

export type DownloadFormat = 'pdf' | 'docx';

export type DownloadClaims = {
  userId: string;
  documentId: string;
  format: DownloadFormat;
  expiresAt: number;
};

export function createDownloadSignature(
  claims: DownloadClaims,
  secret: string,
): string {
  return createHmac('sha256', secret)
    .update(canonicalClaims(claims))
    .digest('hex');
}

export function verifyDownloadSignature(
  claims: DownloadClaims,
  signature: string,
  secret: string,
  now = new Date(),
): boolean {
  if (claims.expiresAt * 1000 <= now.getTime()) return false;
  const expected = Buffer.from(createDownloadSignature(claims, secret), 'hex');
  let provided: Buffer;
  try {
    provided = Buffer.from(signature, 'hex');
  } catch {
    return false;
  }
  return (
    provided.length === expected.length && timingSafeEqual(expected, provided)
  );
}

function canonicalClaims(claims: DownloadClaims): string {
  return `${claims.userId}:${claims.documentId}:${claims.format}:${claims.expiresAt}`;
}
