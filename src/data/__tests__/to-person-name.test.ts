import { describe, expect, it } from 'vitest';

import { toPersonName } from 'src/data/to-person-name';

describe('toPersonName', () => {
  it.each([
    [{ firstName: ' Ana ', lastName: 'Test ' }, 'Ana Test'],
    [{ firstName: 'Ana', lastName: '' }, 'Ana'],
    [{ firstName: null, lastName: 'Test' }, 'Test'],
    [{}, ''],
    [null, ''],
  ])('joins %j into %j', (name, expected) => {
    expect(toPersonName(name)).toBe(expected);
  });
});
