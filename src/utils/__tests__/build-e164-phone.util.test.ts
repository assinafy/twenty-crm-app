import { describe, expect, it } from 'vitest';

import { buildE164Phone } from 'src/utils/build-e164-phone.util';

describe('buildE164Phone', () => {
  it('joins the calling code and the national number', () => {
    expect(buildE164Phone('+55', '(48) 99999-0000')).toBe('+5548999990000');
    expect(buildE164Phone('55', '48999990000')).toBe('+5548999990000');
  });

  it.each([
    [null, '48999990000'],
    [undefined, '48999990000'],
    ['+', '48999990000'],
    ['+55', null],
    ['+55', undefined],
    ['+55', ''],
    ['+55', '123'],
  ])('returns null for (%s, %s)', (callingCode, number) => {
    expect(buildE164Phone(callingCode, number)).toBeNull();
  });
});
