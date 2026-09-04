export type PublicationSideEffect = {
  kind: 'search-index' | 'revalidate' | 'calculate-impact';
  payload: {
    entityType: string;
    entityKey: string;
  };
};

export function nextPublicationVersion(current: number | undefined): number {
  return (current ?? 0) + 1;
}

export function publicationSideEffects(
  entityType: string,
  entityKey: string,
): readonly PublicationSideEffect[] {
  return [
    { kind: 'search-index', payload: { entityType, entityKey } },
    { kind: 'revalidate', payload: { entityType, entityKey } },
    { kind: 'calculate-impact', payload: { entityType, entityKey } },
  ];
}

export function canPublishReview(status: string | undefined): boolean {
  return status === 'approved';
}
