import { type CoreApiClient } from 'twenty-client-sdk/core';
import { describe, expect, it, vi } from 'vitest';

import { ASSINAFY_DOCUMENT_SELECTION } from 'src/data/assinafy-document-selection';
import { findRecordDocuments } from 'src/data/find-record-documents';

describe('findRecordDocuments', () => {
  it('lists documents linked to the record through any relation, newest first', async () => {
    const query = vi.fn<() => Promise<unknown>>(async () => ({
      assinafyDocuments: { edges: [{ node: { id: 'record-doc-1', updatedAt: '2026-09-25T12:00:00.000Z' } }] },
    }));

    const documents = await findRecordDocuments({ query } as unknown as CoreApiClient, 'record-1');

    expect(query).toHaveBeenCalledWith({
      assinafyDocuments: {
        __args: {
          filter: {
            or: [
              { personId: { eq: 'record-1' } },
              { companyId: { eq: 'record-1' } },
              { opportunityId: { eq: 'record-1' } },
            ],
          },
          orderBy: [{ createdAt: 'DescNullsLast' }],
          first: 50,
        },
        edges: { node: ASSINAFY_DOCUMENT_SELECTION },
      },
    });
    expect(documents.map((document) => document.id)).toEqual(['record-doc-1']);
  });
});
