import { describe, expect, it } from 'vitest';

import { toCents } from 'src/utils/to-cents.util';

describe('toCents', () => {
  it('rounds away floating point noise', () => {
    expect(0.45 * 13).not.toBe(5.85);
    expect(toCents(0.45 * 13)).toBe(toCents(5.85));
    expect(toCents(0.45 * 19)).toBe(855);
    expect(toCents(0.1 + 0.2)).toBe(30);
  });

  it('converts whole credits', () => {
    expect(toCents(0)).toBe(0);
    expect(toCents(2)).toBe(200);
  });
});
