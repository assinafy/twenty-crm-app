import { describe, expect, it } from 'vitest';

import { formatCredits } from 'src/front-components/utils/format-credits.util';

describe('formatCredits', () => {
  it('formats with the pt-BR separators and at most two decimals', () => {
    expect(formatCredits(2.45)).toBe('2,45');
    expect(formatCredits(0.45 * 3)).toBe('1,35');
    expect(formatCredits(3)).toBe('3');
    expect(formatCredits(1234.5)).toBe('1.234,5');
  });
});
