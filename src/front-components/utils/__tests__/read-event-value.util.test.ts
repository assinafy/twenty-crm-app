import { describe, expect, it } from 'vitest';

import { readEventValue } from 'src/front-components/utils/read-event-value.util';

describe('readEventValue', () => {
  it('prefers detail.value, then value, then target.value', () => {
    expect(readEventValue({ detail: { value: 'a' }, value: 'b', target: { value: 'c' } })).toBe('a');
    expect(readEventValue({ detail: {}, value: 'b', target: { value: 'c' } })).toBe('b');
    expect(readEventValue({ target: { value: 'c' } })).toBe('c');
  });

  it.each([undefined, null, {}, { target: { value: 3 } }])('reads %j as an empty string', (event) => {
    expect(readEventValue(event)).toBe('');
  });
});
