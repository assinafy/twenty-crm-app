import { describe, expect, it } from 'vitest';

import { errorName } from 'src/utils/error-name.util';

describe('errorName', () => {
  it('returns the class name of an Error', () => {
    expect(errorName(new TypeError('x'))).toBe('TypeError');
  });

  it('returns the type of a non-Error value', () => {
    expect(errorName('boom')).toBe('string');
  });
});
