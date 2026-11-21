import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

export { buildDprDocumentModel, DPR_DISCLAIMER } from './dpr-model';
export { renderDeterministicDocx } from './render-docx';
export { renderDeterministicPdf } from './render-pdf';

import { renderDeterministicDocx } from './render-docx';
import { renderDeterministicPdf } from './render-pdf';

export type DprTable = {
  readonly caption?: string;
  readonly columns: readonly string[];
  readonly rows: ReadonlyArray<readonly string[]>;
  /** Relative column widths; defaults to a wide first column. */
  readonly widths?: readonly number[];
  /** Row indices (or the last row) to print in bold. */
  readonly emphasis?: 'last' | readonly number[];
  /** Right-align every column after the first. */
  readonly numeric?: boolean;
  /** Print the column header row (default true). */
  readonly header?: boolean;
};

export type DprSection = {
  readonly heading: string;
  readonly paragraphs: readonly string[];
  readonly tables?: readonly DprTable[];
  readonly notes?: readonly string[];
};

export type DprDocumentModel = {
  title: string;
  documentVersion: number;
  generatedAt: string;
  cover?: {
    readonly subtitle: string;
    readonly preparedFor: string;
    readonly preparedOn: string;
    readonly highlights: ReadonlyArray<readonly [string, string]>;
  };
  sections: readonly DprSection[];
};

export function resolveDocumentStorageDir(
  configured = process.env.DOCUMENT_STORAGE_DIR,
): string {
  const cwd = process.cwd();
  // Inside apps/web or apps/worker, resolve against the monorepo root so the
  // web app (which serves files) and the worker (which writes them) agree
  // even when DOCUMENT_STORAGE_DIR is the relative `.data/documents`.
  const base =
    path.basename(path.dirname(cwd)) === 'apps'
      ? path.resolve(cwd, '..', '..')
      : cwd;
  return path.resolve(base, configured ?? path.join('.data', 'documents'));
}

export function documentStorageKey(
  documentId: string,
  version: number,
  format: 'pdf' | 'docx',
): string {
  return path.posix.join(documentId, `v${version}.${format}`);
}

export function resolveStoredDocumentPath(
  storageKey: string,
  configured = process.env.DOCUMENT_STORAGE_DIR,
): string {
  const root = path.resolve(resolveDocumentStorageDir(configured));
  const resolved = path.resolve(root, storageKey);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error('Document storage key escaped the storage root.');
  }
  return resolved;
}

export async function persistGeneratedDocuments(options: {
  documentId: string;
  version: number;
  model: DprDocumentModel;
  storageDir?: string;
}): Promise<{ docxStorageKey: string; pdfStorageKey: string }> {
  const docxStorageKey = documentStorageKey(
    options.documentId,
    options.version,
    'docx',
  );
  const pdfStorageKey = documentStorageKey(
    options.documentId,
    options.version,
    'pdf',
  );
  const docxPath = resolveStoredDocumentPath(
    docxStorageKey,
    options.storageDir,
  );
  const pdfPath = resolveStoredDocumentPath(pdfStorageKey, options.storageDir);
  await mkdir(path.dirname(docxPath), { recursive: true });
  await writeFile(docxPath, renderDeterministicDocx(options.model));
  await writeFile(pdfPath, await renderDeterministicPdf(options.model));
  return { docxStorageKey, pdfStorageKey };
}

export async function removeStoredDocuments(
  storageKeys: ReadonlyArray<string | null | undefined>,
  configured = process.env.DOCUMENT_STORAGE_DIR,
): Promise<string[]> {
  const removed: string[] = [];
  for (const key of storageKeys) {
    if (key === undefined || key === null || key.length === 0) continue;
    try {
      await unlink(resolveStoredDocumentPath(key, configured));
      removed.push(key);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  return removed;
}
