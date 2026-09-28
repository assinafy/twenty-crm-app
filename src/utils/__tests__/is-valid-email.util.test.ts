import { describe, expect, it } from 'vitest';

import { isValidEmail } from 'src/utils/is-valid-email.util';

describe('isValidEmail', () => {
  it.each([
    ['signer@example.invalid', true],
    ['first.last+tag@sub.example.invalid', true],
    ['signer@example', false],
    ['signer example@example.invalid', false],
    ['@example.invalid', false],
    ['signer@@example.invalid', false],
    ['', false],
  ])('%s → %s', (value, expected) => {
    expect(isValidEmail(value)).toBe(expected);
  });

  it('accepts 254 characters and rejects 255', () => {
    expect(isValidEmail(`${'a'.repeat(238)}@example.invalid`)).toBe(true);
    expect(isValidEmail(`${'a'.repeat(239)}@example.invalid`)).toBe(false);
  });
});
