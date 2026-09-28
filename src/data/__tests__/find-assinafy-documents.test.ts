import { describe, expect, it } from 'vitest';

import { fakeCore } from 'src/data/__tests__/fake-core';
import { ASSINAFY_DOCUMENT_SELECTION } from 'src/data/assinafy-document-selection';
import { findAssinafyDocuments } from 'src/data/find-assinafy-documents';

const UPDATED_AT = '2026-01-02T00:00:00.000Z';

describe('findAssinafyDocuments', () => {
  it('sends the args with the full record selection and maps the nodes', async () => {
    const { core, query } = fakeCore({
      assinafyDocuments: {
        edges: [
          { node: { id: 'a', status: 'PENDING_SIGNATURE', updatedAt: UPDATED_AT } },
          { node: { id: 'b', status: 'UNKNOWN', updatedAt: UPDATED_AT } },
        ],
      },
    });
    const args = { filter: { requestId: { eq: 'request-1' } }, orderBy: [{ sentAt: 'DescNullsLast' as const }], first: 2 };

    const records = await findAssinafyDocuments(core, args);

    expect(query).toHaveBeenCalledWith({
      assinafyDocuments: { __args: args, edges: { node: ASSINAFY_DOCUMENT_SELECTION } },
    });
    expect(records.map(({ id, status, name }) => ({ id, status, name }))).toEqual([
      { id: 'a', status: 'PENDING_SIGNATURE', name: null },
      { id: 'b', status: 'UNKNOWN', name: null },
    ]);
  });

  it('returns an empty list when the connection is missing', async () => {
    const { core } = fakeCore({ assinafyDocuments: null });

    await expect(findAssinafyDocuments(core, { filter: {}, first: 1 })).resolves.toEqual([]);
  });

  it('selects the signed files with their download url', () => {
    expect(ASSINAFY_DOCUMENT_SELECTION.signedDocument).toEqual({ fileId: true, label: true, url: true });
  });
});
