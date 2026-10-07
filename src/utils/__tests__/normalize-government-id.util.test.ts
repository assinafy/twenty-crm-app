import { describe, expect, it } from 'vitest';

import { normalizeGovernmentId } from 'src/utils/normalize-government-id.util';

describe('normalizeGovernmentId', () => {
  it.each([
    ['CPF with punctuation', '000.000.001-91', '00000000191'],
    ['CPF digits', '00000000191', '00000000191'],
    ['CNPJ with punctuation', '00.000.000/0001-91', '00000000000191'],
    ['12 digits', '000000000191', null],
    ['10 digits', '0000000191', null],
    ['alphanumeric CNPJ with punctuation', '12.abc.345/01de-35', '12ABC34501DE35'],
    ['alphanumeric CNPJ', '12ABC34501DE35', '12ABC34501DE35'],
    ['CNPJ with letters in the check digits', '12ABC34501DEAB', null],
    ['letters in a CPF', 'abc00000191', null],
    ['letters in a short id', 'abc0000000019', null],
    ['empty', '', null],
  ])('%s', (_label, raw, expected) => {
    expect(normalizeGovernmentId(raw)).toBe(expected);
  });
});
