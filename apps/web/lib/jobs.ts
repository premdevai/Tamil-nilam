export function canClaimDocumentStatus(status: string): boolean {
  return status === 'queued' || status === 'failed';
}

export function checkoutReplayDecision(existing: unknown): 'replay' | 'create' {
  return existing === undefined || existing === null ? 'create' : 'replay';
}

export function authorizationDecision(
  hasSession: boolean,
  allowed: boolean,
): 'unauthorized' | 'forbidden' | 'ok' {
  if (!hasSession) return 'unauthorized';
  if (!allowed) return 'forbidden';
  return 'ok';
}
