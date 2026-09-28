import { describe, expect, it } from 'vitest';

import { isPermissionDenied } from 'src/data/is-permission-denied';

const forbidden = { message: 'Permission denied', extensions: { code: 'FORBIDDEN', subCode: 'PERMISSION_DENIED' } };

describe('isPermissionDenied', () => {
  it('is true when every GraphQL error is a permission denial', () => {
    expect(isPermissionDenied({ errors: [forbidden, forbidden] })).toBe(true);
  });

  it.each([
    ['a non-object', 'FORBIDDEN'],
    ['null', null],
    ['an error without GraphQL errors', new Error('network')],
    ['an empty error list', { errors: [] }],
    ['a list that is not an array', { errors: forbidden }],
    ['a denial next to another error', { errors: [forbidden, { extensions: { code: 'INTERNAL_SERVER_ERROR' } }] }],
    ['an entry without extensions', { errors: [null] }],
  ])('is false for %s', (_label, error) => {
    expect(isPermissionDenied(error)).toBe(false);
  });
});
