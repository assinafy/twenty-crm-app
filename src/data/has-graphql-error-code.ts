type GraphqlErrorLike = { extensions?: { code?: unknown } } | null | undefined;

// True only when Twenty reported at least one GraphQL error and every one carries extensions.code === code.
export const hasGraphqlErrorCode = (error: unknown, code: string): boolean => {
  const errors = typeof error === 'object' && error !== null ? (error as { errors?: unknown }).errors : undefined;

  return (
    Array.isArray(errors) &&
    errors.length > 0 &&
    (errors as GraphqlErrorLike[]).every((entry) => entry?.extensions?.code === code)
  );
};
