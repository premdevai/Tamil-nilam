export function canClaimDocumentStatus(status: string): boolean {
  return status === 'queued' || status === 'failed';
}
