import { describe, expect, it } from 'vitest';

import { fakeCore } from 'src/data/__tests__/fake-core';
import { ASSINAFY_DOCUMENT_SELECTION } from 'src/data/assinafy-document-selection';
import { findAssinafyDocumentByRequestId } from 'src/data/find-assinafy-document-by-request-id';

describe('findAssinafyDocumentByRequestId', () => {
  it('filters by requestId with first 1', async () => {
    const { core, query } = fakeCore({
      assinafyDocuments: {
        edges: [{ node: { id: 'record-1', requestId: 'request-1', updatedAt: '2026-01-02T00:00:00.000Z' } }],
      },
    });

    const record = await findAssinafyDocumentByRequestId(core, 'request-1');

    expect(query).toHaveBeenCalledWith({
      assinafyDocuments: {
        __args: { filter: { requestId: { eq: 'request-1' } }, first: 1 },
        edges: { node: ASSINAFY_DOCUMENT_SELECTION },
      },
    });
    expect(record?.requestId).toBe('request-1');
  });

  it('returns null when nothing matches', async () => {
    const { core } = fakeCore({ assinafyDocuments: { edges: [] } });

    await expect(findAssinafyDocumentByRequestId(core, 'request-1')).resolves.toBeNull();
  });
});
