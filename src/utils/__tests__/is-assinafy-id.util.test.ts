import { describe, expect, it } from 'vitest';

import { isAssinafyId } from 'src/utils/is-assinafy-id.util';

describe('isAssinafyId', () => {
  it.each([
    ['a1B2_c3-d4', true],
    ['x'.repeat(64), true],
    ['x'.repeat(65), false],
    ['', false],
    ['doc/1', false],
    ['doc 1', false],
    ['../doc', false],
  ])('%s → %s', (value, expected) => {
    expect(isAssinafyId(value)).toBe(expected);
  });
});
