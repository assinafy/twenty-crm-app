// Observed on Twenty 2.42 (GenqlError.errors[0] of a duplicate create; GenqlError.message joins the messages):
//   { message: 'A duplicate entry was detected: unique constraint person.IDX_UNIQUE_… was violated',
//     extensions: { code: 'BAD_USER_INPUT', userFriendlyMessage: 'This record already exists. …' } }
// Also accepts the raw Postgres wording ('duplicate key value violates unique constraint'). A bare "duplicate" is not
// enough: other BAD_USER_INPUT errors say it too ('Duplicate root resolver').
const UNIQUE_VIOLATION_PATTERN = /unique[ _](?:constraint|violation)|duplicate[ _](?:entry|key)/i;

type GraphqlErrorLike = { message?: unknown; extensions?: { code?: unknown } } | null | undefined;

export const isUniqueViolation = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const { errors } = error as { errors?: unknown };
  const entries = [error, ...(Array.isArray(errors) ? errors : [])] as GraphqlErrorLike[];

  return entries.some((entry) =>
    [entry?.message, entry?.extensions?.code].some(
      (text) => typeof text === 'string' && UNIQUE_VIOLATION_PATTERN.test(text),
    ),
  );
};
