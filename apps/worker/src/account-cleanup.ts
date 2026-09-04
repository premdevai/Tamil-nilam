import { removeStoredDocuments } from '@nilam/paid/documents';

type DocumentKeyRow = {
  docx: string | null;
  pdf: string | null;
};

export type DocumentKeyQuery = (
  text: string,
  values?: unknown[],
) => Promise<{ rows: DocumentKeyRow[] }>;

export function flattenDocumentStorageKeys(
  rows: ReadonlyArray<DocumentKeyRow>,
): string[] {
  return rows.flatMap((row) =>
    [row.docx, row.pdf].filter(
      (key): key is string => key !== null && key.length > 0,
    ),
  );
}

export async function collectUserDocumentStorageKeys(
  query: DocumentKeyQuery,
  userId: string,
): Promise<string[]> {
  const [dprs, reports] = await Promise.all([
    query(
      `select docx_storage_key as docx, pdf_storage_key as pdf
       from generated_dprs where user_id = $1::uuid`,
      [userId],
    ),
    query(
      `select docx_storage_key as docx, pdf_storage_key as pdf
       from printable_reports where user_id = $1::uuid`,
      [userId],
    ),
  ]);
  return flattenDocumentStorageKeys([...dprs.rows, ...reports.rows]);
}

export async function deleteAccountDocuments(
  query: DocumentKeyQuery,
  userId: string,
): Promise<string[]> {
  const keys = await collectUserDocumentStorageKeys(query, userId);
  return removeStoredDocuments(keys);
}
