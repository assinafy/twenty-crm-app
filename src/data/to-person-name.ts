export const toPersonName = (name: { firstName?: string | null; lastName?: string | null } | null | undefined): string =>
  [name?.firstName, name?.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ');
