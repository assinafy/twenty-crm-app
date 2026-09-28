import { describe, expect, it } from 'vitest';

import { normalizePhone } from 'src/utils/normalize-phone.util';

describe('normalizePhone', () => {
  it.each([
    ['+5548999990000', '+5548999990000'],
    ['+55 (48) 99999-0000', '+5548999990000'],
    ['+1.555.010.0000', '+15550100000'],
    ['+1/555/0100', '+15550100'],
  ])('normalizes %s', (raw, expected) => {
    expect(normalizePhone(raw)).toBe(expected);
  });

  it.each([
    ['7 digits', '+1234567', null],
    ['8 digits', '+12345678', '+12345678'],
    ['15 digits', '+123456789012345', '+123456789012345'],
    ['16 digits', '+1234567890123456', null],
    ['leading +0', '+0123456789', null],
    ['no plus', '5548999990000', null],
    ['letters', '+55489999ABCD', null],
    ['empty', '', null],
  ])('%s', (_label, raw, expected) => {
    expect(normalizePhone(raw)).toBe(expected);
  });
});
