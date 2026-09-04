import { describe, expect, it } from 'vitest';

import {
  downloadQueryAuthorized,
  signedDownloadQuery,
} from './document-download';

describe('signed downloads', () => {
  it('issues a verifiable expiring query string', () => {
    const now = new Date('2026-08-21T00:00:00.000Z');
    const query = signedDownloadQuery({
      userId: 'user-1',
      documentId: 'doc-1',
      format: 'docx',
      now,
    });
    expect(
      downloadQueryAuthorized({
        userId: 'user-1',
        documentId: 'doc-1',
        format: query.format,
        exp: query.exp,
        sig: query.sig,
        now,
      }),
    ).toBe('docx');
    expect(
      downloadQueryAuthorized({
        userId: 'user-1',
        documentId: 'doc-1',
        format: query.format,
        exp: query.exp,
        sig: '00',
        now,
      }),
    ).toBeUndefined();
  });
});
