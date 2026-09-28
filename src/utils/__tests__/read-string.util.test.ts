import { describe, expect, it } from 'vitest';

import { readString } from 'src/utils/read-string.util';

const invalid = (details: Record<string, unknown>) => expect.objectContaining({ code: 'INVALID_INPUT', details });
const test = (value: string) => value.startsWith('ok');

describe('readString', () => {
  it('trims the value', () => {
    expect(readString('  Contract  ', 'name')).toBe('Contract');
  });

  it.each([undefined, null, '', '   '])('reads %j as null when optional', (value) => {
    expect(readString(value, 'name')).toBeNull();
  });

  it.each([undefined, null, '', '   '])('rejects %j when required', (value) => {
    expect(() => readString(value, 'name', { required: true })).toThrow(invalid({ field: 'name', reason: 'required' }));
  });

  it.each([1, true, {}, []])('rejects the non-string %j', (value) => {
    expect(() => readString(value, 'name')).toThrow(invalid({ field: 'name', reason: 'type' }));
  });

  it('applies max to the trimmed value', () => {
    expect(readString(` ${'a'.repeat(5)} `, 'name', { max: 5 })).toBe('aaaaa');
    expect(() => readString('a'.repeat(6), 'name', { max: 5 })).toThrow(invalid({ field: 'name', reason: 'too_long' }));
  });

  it('applies the format test', () => {
    expect(readString('ok-1', 'id', { test })).toBe('ok-1');
    expect(() => readString('no', 'id', { test, index: 1 })).toThrow(
      invalid({ field: 'id', reason: 'format', index: 1 }),
    );
  });
});
