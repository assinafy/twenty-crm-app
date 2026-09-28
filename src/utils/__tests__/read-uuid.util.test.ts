import { describe, expect, it } from 'vitest';

import { readUuid } from 'src/utils/read-uuid.util';

const invalid = (details: Record<string, unknown>) => expect.objectContaining({ code: 'INVALID_INPUT', details });

describe('readUuid', () => {
  it('returns a uuid', () => {
    expect(readUuid('0b7c3a2e-6f1d-4c8a-9e2b-5d4f3a1b2c3d', 'recordId')).toBe('0b7c3a2e-6f1d-4c8a-9e2b-5d4f3a1b2c3d');
  });

  it('lowercases an uppercase uuid', () => {
    expect(readUuid('0B7C3A2E-6F1D-4C8A-9E2B-5D4F3A1B2C3D', 'recordId')).toBe('0b7c3a2e-6f1d-4c8a-9e2b-5d4f3a1b2c3d');
  });

  it('rejects non-uuids and missing values', () => {
    expect(() => readUuid('record-1', 'recordId')).toThrow(invalid({ field: 'recordId', reason: 'format' }));
    expect(() => readUuid(undefined, 'signers', 3)).toThrow(invalid({ field: 'signers', reason: 'required', index: 3 }));
  });
});
