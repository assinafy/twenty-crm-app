import { describe, expect, it } from 'vitest';

import { normalizeGovernmentId } from 'src/utils/normalize-government-id.util';

describe('normalizeGovernmentId', () => {
  it.each([
    ['CPF with punctuation', '000.000.001-91', '00000000191'],
    ['CPF digits', '00000000191', '00000000191'],
    ['CNPJ with punctuation', '00.000.000/0001-91', '00000000000191'],
    ['12 digits', '000000000191', null],
    ['10 digits', '0000000191', null],
    ['letters', 'abc00000000191', null],
    ['empty', '', null],
  ])('%s', (_label, raw, expected) => {
    expect(normalizeGovernmentId(raw)).toBe(expected);
  });
});
