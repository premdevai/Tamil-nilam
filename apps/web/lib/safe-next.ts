/**
 * Same-origin relative path to return to after sign-in, or undefined.
 * Rejects protocol-relative (`//evil`) and backslash tricks.
 */
export function safeNextPath(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2_000) {
    return undefined;
  }
  if (
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\')
  ) {
    return undefined;
  }
  return value;
}
