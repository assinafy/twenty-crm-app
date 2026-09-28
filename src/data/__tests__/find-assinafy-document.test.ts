import { describe, expect, it } from 'vitest';

import { fakeCore } from 'src/data/__tests__/fake-core';
import { ASSINAFY_DOCUMENT_SELECTION } from 'src/data/assinafy-document-selection';
import { findAssinafyDocument } from 'src/data/find-assinafy-document';

describe('findAssinafyDocument', () => {
  it('filters by id with first 1', async () => {
    const { core, query } = fakeCore({
      assinafyDocuments: { edges: [{ node: { id: 'record-1', updatedAt: '2026-01-02T00:00:00.000Z' } }] },
    });

    const record = await findAssinafyDocument(core, 'record-1');

    expect(query).toHaveBeenCalledWith({
      assinafyDocuments: {
        __args: { filter: { id: { eq: 'record-1' } }, first: 1 },
        edges: { node: ASSINAFY_DOCUMENT_SELECTION },
      },
    });
    expect(record?.id).toBe('record-1');
  });

  it('returns null when nothing matches', async () => {
    const { core } = fakeCore({ assinafyDocuments: { edges: [] } });

    await expect(findAssinafyDocument(core, 'record-1')).resolves.toBeNull();
  });
});
