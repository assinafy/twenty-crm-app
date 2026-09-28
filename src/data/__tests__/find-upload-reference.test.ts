import { describe, expect, it } from 'vitest';

import { fakeCore } from 'src/data/__tests__/fake-core';
import { ASSINAFY_DOCUMENT_SELECTION } from 'src/data/assinafy-document-selection';
import { findUploadReference } from 'src/data/find-upload-reference';

describe('findUploadReference', () => {
  it('returns the one record other than a FAILED send that points at the upload', async () => {
    const { core, query } = fakeCore({
      assinafyDocuments: { edges: [{ node: { id: 'record-1', updatedAt: '2026-01-02T00:00:00.000Z' } }] },
    });

    await expect(findUploadReference(core, 'doc-1')).resolves.toMatchObject({ id: 'record-1' });
    expect(query).toHaveBeenCalledWith({
      assinafyDocuments: {
        __args: {
          filter: {
            assinafyDocumentId: { eq: 'doc-1' },
            or: [{ status: { neq: 'FAILED' } }, { status: { is: 'NULL' } }],
          },
          first: 1,
        },
        edges: { node: ASSINAFY_DOCUMENT_SELECTION },
      },
    });
  });

  it('is null when no such record exists', async () => {
    const { core } = fakeCore({ assinafyDocuments: { edges: [] } });

    await expect(findUploadReference(core, 'doc-1')).resolves.toBeNull();
  });
});
