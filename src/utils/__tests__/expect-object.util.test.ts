import { describe, expect, it } from 'vitest';

import { expectObject } from 'src/utils/expect-object.util';

const invalid = (details: Record<string, unknown>) => expect.objectContaining({ code: 'INVALID_INPUT', details });

describe('expectObject', () => {
  it('returns plain objects with allowed keys', () => {
    expect(expectObject({ a: 1 }, 'body', ['a', 'b'])).toEqual({ a: 1 });
  });

  it('accepts any key when no allow-list is given', () => {
    expect(expectObject({ anything: true }, 'body')).toEqual({ anything: true });
  });

  it.each([null, undefined, 'text', 1, [], [{ a: 1 }]])('rejects %j', (raw) => {
    expect(() => expectObject(raw, 'body', ['a'])).toThrow(invalid({ field: 'body', reason: 'type' }));
  });

  it('rejects unknown keys, naming them', () => {
    expect(() => expectObject({ a: 1, extra: 2 }, 'body', ['a'])).toThrow(
      invalid({ field: 'body.extra', reason: 'unknown_key' }),
    );
  });

  it('truncates long unknown key names and keeps the item index', () => {
    const key = 'k'.repeat(100);

    expect(() => expectObject({ [key]: 1 }, 'signers', [], 4)).toThrow(
      invalid({ field: `signers.${'k'.repeat(64)}`, reason: 'unknown_key', index: 4 }),
    );
  });
});
