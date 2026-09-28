import { describe, expect, it } from 'vitest';

import { hasGraphqlErrorCode } from 'src/data/has-graphql-error-code';

const notFound = { message: 'Record not found', extensions: { code: 'NOT_FOUND', subCode: 'RECORD_NOT_FOUND' } };

describe('hasGraphqlErrorCode', () => {
  it('is true when every GraphQL error carries the code', () => {
    expect(hasGraphqlErrorCode({ errors: [notFound, notFound] }, 'NOT_FOUND')).toBe(true);
  });

  it.each([
    ['a non-object', 'NOT_FOUND'],
    ['null', null],
    ['an error without GraphQL errors', new Error('network')],
    ['an empty error list', { errors: [] }],
    ['a list that is not an array', { errors: notFound }],
    ['the code next to another error', { errors: [notFound, { extensions: { code: 'FORBIDDEN' } }] }],
    ['an entry without extensions', { errors: [null] }],
  ])('is false for %s', (_label, error) => {
    expect(hasGraphqlErrorCode(error, 'NOT_FOUND')).toBe(false);
  });
});
