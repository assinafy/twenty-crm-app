import { describe, expect, it, vi } from 'vitest';

import { createRequestId } from 'src/front-components/utils/create-request-id.util';
import { isUuid } from 'src/utils/is-uuid.util';

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('createRequestId', () => {
  it('returns version 4 UUIDs the send route accepts', () => {
    const ids = Array.from({ length: 200 }, createRequestId);

    expect(ids.every((id) => V4.test(id) && isUuid(id))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('sets the version and variant bits whatever the random bytes are', () => {
    vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
      (array as Uint8Array).fill(0xff);
      return array;
    });

    expect(createRequestId()).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
  });

  it('works where crypto.randomUUID does not exist, as in the front-component worker', () => {
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) });

    expect(V4.test(createRequestId())).toBe(true);
  });
});
