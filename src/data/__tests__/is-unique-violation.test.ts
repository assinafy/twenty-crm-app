import { describe, expect, it } from 'vitest';

import { isUniqueViolation } from 'src/data/is-unique-violation';

// Same shape as the client's GenqlError: message joins errors[].message.
const genqlError = (errors: unknown[]) =>
  Object.assign(new Error(errors.map((entry) => (entry as { message?: string })?.message ?? '').join('\n')), {
    errors,
  });

describe('isUniqueViolation', () => {
  it('matches the duplicate-entry error observed on Twenty 2.42', () => {
    expect(
      isUniqueViolation(
        genqlError([
          {
            message:
              'A duplicate entry was detected: unique constraint person.IDX_UNIQUE_87914cd3ce963115f8cb943e2ac was violated',
            extensions: {
              userFriendlyMessage: 'This record already exists. Please check your data and try again.',
              code: 'BAD_USER_INPUT',
            },
          },
        ]),
      ),
    ).toBe(true);
  });

  it('matches the raw Postgres wording in a plain error message', () => {
    expect(isUniqueViolation(new Error('duplicate key value violates unique constraint "IDX_request_id"'))).toBe(true);
  });

  it('matches an extensions code naming the violation even with a generic message', () => {
    expect(
      isUniqueViolation({ message: 'GraphQL error', errors: [null, { extensions: { code: 'DUPLICATE_KEY' } }] }),
    ).toBe(true);
  });

  it.each([
    ['a permission error', genqlError([{ message: 'field "status" is not writable', extensions: { code: 'FORBIDDEN' } }])],
    ['another duplicate wording', genqlError([{ message: 'Duplicate root resolver: "people"' }])],
    ['an error without message', { errors: 'not-an-array' }],
    ['a string', 'duplicate key'],
    ['null', null],
  ])('ignores %s', (_label, error) => {
    expect(isUniqueViolation(error)).toBe(false);
  });
});
