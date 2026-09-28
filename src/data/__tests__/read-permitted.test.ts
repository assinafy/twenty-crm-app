import { describe, expect, it } from 'vitest';

import { permissionDenied } from 'src/data/__tests__/permission-denied';
import { readPermitted } from 'src/data/read-permitted';

describe('readPermitted', () => {
  it('returns the read result', async () => {
    await expect(readPermitted(async () => ({ people: { edges: [] } }))).resolves.toEqual({ people: { edges: [] } });
  });

  it('keeps the partial data Twenty returned next to a permission denial', async () => {
    const data = { people: { edges: [] }, opportunities: null };

    await expect(readPermitted(() => Promise.reject(permissionDenied(data)))).resolves.toBe(data);
  });

  it.each([
    ['a denial without data', permissionDenied(null)],
    ['any other error', Object.assign(new Error('boom'), { errors: [{ extensions: { code: 'INTERNAL' } }], data: {} })],
    ['a thrown non-object', undefined],
  ])('rethrows %s', async (_label, error) => {
    await expect(readPermitted(() => Promise.reject(error))).rejects.toBe(error);
  });
});
