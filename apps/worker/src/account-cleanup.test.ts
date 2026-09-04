import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { resolveStoredDocumentPath } from '@nilam/paid/documents';
import { describe, expect, it } from 'vitest';

import {
  deleteAccountDocuments,
  flattenDocumentStorageKeys,
} from './account-cleanup.js';

describe('account deletion file cleanup', () => {
  it('collects only persisted document keys', () => {
    expect(
      flattenDocumentStorageKeys([
        { docx: 'a/v1.docx', pdf: 'a/v1.pdf' },
        { docx: null, pdf: '' },
      ]),
    ).toEqual(['a/v1.docx', 'a/v1.pdf']);
  });

  it('removes generated files before the account rows disappear', async () => {
    const directory = await mkdir(
      path.join(os.tmpdir(), `nilam-cleanup-${Date.now()}`),
      { recursive: true },
    );
    process.env.DOCUMENT_STORAGE_DIR = directory;
    const keys = ['user-doc/v1.docx', 'user-doc/v1.pdf'];
    for (const key of keys) {
      const filePath = resolveStoredDocumentPath(key, directory);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, 'document');
    }
    const removed = await deleteAccountDocuments(
      async () => ({
        rows: [
          { docx: keys[0] ?? null, pdf: keys[1] ?? null },
          { docx: null, pdf: null },
        ],
      }),
      '11111111-1111-4111-8111-111111111111',
    );
    expect(removed).toEqual(keys);
  });
});
