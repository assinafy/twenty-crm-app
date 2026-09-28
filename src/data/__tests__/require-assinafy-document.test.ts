import { describe, expect, it } from 'vitest';

import { fakeCore } from 'src/data/__tests__/fake-core';
import { requireAssinafyDocument } from 'src/data/require-assinafy-document';

describe('requireAssinafyDocument', () => {
  it('returns the record when it is found', async () => {
    const { core } = fakeCore({
      assinafyDocuments: { edges: [{ node: { id: 'record-1', updatedAt: '2026-01-02T00:00:00.000Z' } }] },
    });

    await expect(requireAssinafyDocument(core, 'record-1')).resolves.toMatchObject({ id: 'record-1' });
  });

  it('fails with NOT_FOUND when nothing matches', async () => {
    const { core } = fakeCore({ assinafyDocuments: { edges: [] } });

    await expect(requireAssinafyDocument(core, 'record-1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Documento não encontrado.',
    });
  });
});
