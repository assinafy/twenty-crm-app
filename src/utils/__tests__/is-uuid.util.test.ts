import { describe, expect, it } from 'vitest';

import { isUuid } from 'src/utils/is-uuid.util';

describe('isUuid', () => {
  it.each([
    ['0b7c3a2e-6f1d-4c8a-9e2b-5d4f3a1b2c3d', true],
    ['0B7C3A2E-6F1D-4C8A-9E2B-5D4F3A1B2C3D', true],
    ['20202020-2d40-4e49-8df4-9c6a049191de', true],
    ['0b7c3a2e6f1d4c8a9e2b5d4f3a1b2c3d', false],
    ['0b7c3a2e-6f1d-4c8a-9e2b-5d4f3a1b2c3', false],
    ['0b7c3a2e-6f1d-4c8a-9e2b-5d4f3a1b2c3d0', false],
    ['zb7c3a2e-6f1d-4c8a-9e2b-5d4f3a1b2c3d', false],
    ['', false],
  ])('%s → %s', (value, expected) => {
    expect(isUuid(value)).toBe(expected);
  });
});
