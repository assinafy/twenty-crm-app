import { describe, expect, it } from 'vitest';

import { readArray } from 'src/utils/read-array.util';

const invalid = (details: Record<string, unknown>) => expect.objectContaining({ code: 'INVALID_INPUT', details });

describe('readArray', () => {
  it('returns arrays within bounds, inclusive', () => {
    expect(readArray([1], 'list', { min: 1, max: 2 })).toEqual([1]);
    expect(readArray([1, 2], 'list', { min: 1, max: 2 })).toEqual([1, 2]);
  });

  it('reads an absent optional array as empty', () => {
    expect(readArray(undefined, 'list', { min: 0, max: 2 })).toEqual([]);
    expect(readArray(null, 'list', { min: 0, max: 2 })).toEqual([]);
  });

  it('requires the array when min is positive', () => {
    expect(() => readArray(undefined, 'list', { min: 1, max: 2 })).toThrow(
      invalid({ field: 'list', reason: 'required' }),
    );
  });

  it('rejects non-arrays and out-of-bounds lengths', () => {
    expect(() => readArray({ 0: 'a' }, 'list', { min: 0, max: 2 })).toThrow(invalid({ field: 'list', reason: 'type' }));
    expect(() => readArray([], 'list', { min: 1, max: 2 })).toThrow(invalid({ field: 'list', reason: 'too_few' }));
    expect(() => readArray([1, 2, 3], 'list', { min: 1, max: 2 })).toThrow(
      invalid({ field: 'list', reason: 'too_many' }),
    );
  });
});
