import { describe, expect, it } from 'vitest';

import { readEnum } from 'src/utils/read-enum.util';

const invalid = (details: Record<string, unknown>) => expect.objectContaining({ code: 'INVALID_INPUT', details });
const OPTIONS = ['PDF', 'TEMPLATE'] as const;

describe('readEnum', () => {
  it('returns a listed option', () => {
    expect(readEnum('TEMPLATE', 'type', OPTIONS)).toBe('TEMPLATE');
    expect(readEnum('PDF', 'type', OPTIONS, { required: true })).toBe('PDF');
  });

  it('reads an absent value as null unless required', () => {
    expect(readEnum(undefined, 'type', OPTIONS)).toBeNull();
    expect(() => readEnum(null, 'type', OPTIONS, { required: true })).toThrow(
      invalid({ field: 'type', reason: 'required' }),
    );
  });

  it('rejects values outside the list, case-sensitively', () => {
    expect(() => readEnum('pdf', 'type', OPTIONS, { index: 0 })).toThrow(
      invalid({ field: 'type', reason: 'format', index: 0 }),
    );
  });
});
