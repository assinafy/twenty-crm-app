import { describe, expect, it } from 'vitest';

import { readNumber } from 'src/utils/read-number.util';

const invalid = (details: Record<string, unknown>) => expect.objectContaining({ code: 'INVALID_INPUT', details });

describe('readNumber', () => {
  it('returns numbers within bounds, inclusive', () => {
    expect(readNumber(0, 'n', { min: 0 })).toBe(0);
    expect(readNumber(1.45, 'n', { min: 0, required: true })).toBe(1.45);
    expect(readNumber(365, 'n', { min: 1, max: 365, integer: true })).toBe(365);
  });

  it('reads an absent value as null unless required', () => {
    expect(readNumber(undefined, 'n', { min: 0 })).toBeNull();
    expect(readNumber(null, 'n', { min: 0 })).toBeNull();
    expect(() => readNumber(undefined, 'n', { min: 0, required: true })).toThrow(
      invalid({ field: 'n', reason: 'required' }),
    );
  });

  it.each(['1', Number.NaN, Number.POSITIVE_INFINITY, true, {}])('rejects %j', (value) => {
    expect(() => readNumber(value, 'n', { min: 0 })).toThrow(invalid({ field: 'n', reason: 'type' }));
  });

  it('rejects fractions when an integer is expected', () => {
    expect(() => readNumber(1.5, 'n', { min: 0, integer: true })).toThrow(invalid({ field: 'n', reason: 'type' }));
  });

  it.each([
    [-0.01, { min: 0 }],
    [0, { min: 1, max: 365 }],
    [366, { min: 1, max: 365 }],
  ])('rejects %s outside %j', (value, bounds) => {
    expect(() => readNumber(value, 'n', bounds)).toThrow(invalid({ field: 'n', reason: 'out_of_range' }));
  });
});
