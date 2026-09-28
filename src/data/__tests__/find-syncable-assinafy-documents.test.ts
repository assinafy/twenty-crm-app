import { describe, expect, it } from 'vitest';

import { fakeCore } from 'src/data/__tests__/fake-core';
import { ASSINAFY_DOCUMENT_SELECTION } from 'src/data/assinafy-document-selection';
import { findSyncableAssinafyDocuments } from 'src/data/find-syncable-assinafy-documents';

describe('findSyncableAssinafyDocuments', () => {
  it('asks for open documents within the sync window, least recently checked first', async () => {
    const { core, query } = fakeCore({
      assinafyDocuments: { edges: [{ node: { id: 'record-1', updatedAt: '2026-06-01T00:00:00.000Z' } }] },
    });

    const records = await findSyncableAssinafyDocuments(core, { now: new Date('2026-06-01T12:00:00.000Z'), limit: 50 });

    expect(query).toHaveBeenCalledWith({
      assinafyDocuments: {
        __args: {
          filter: {
            and: [
              {
                or: [
                  { status: { in: ['PENDING_SIGNATURE', 'CERTIFICATING', 'UNKNOWN'] } },
                  { status: { eq: 'UNCERTAIN' }, assinafyDocumentId: { is: 'NOT_NULL' } },
                  // SEND_LEASE_MS = 180 s before now.
                  { status: { eq: 'SENDING' }, updatedAt: { lt: '2026-06-01T11:57:00.000Z' } },
                ],
              },
              {
                or: [
                  // SYNC_WINDOW_DAYS = 120 days before now.
                  { sentAt: { gte: '2026-02-01T12:00:00.000Z' } },
                  {
                    sentAt: { is: 'NULL' },
                    status: { in: ['UNCERTAIN', 'SENDING'] },
                    createdAt: { gte: '2026-02-01T12:00:00.000Z' },
                  },
                ],
              },
            ],
          },
          orderBy: [{ lastSyncedAt: 'AscNullsFirst' }],
          first: 50,
        },
        edges: { node: ASSINAFY_DOCUMENT_SELECTION },
      },
    });
    expect(records.map(({ id }) => id)).toEqual(['record-1']);
  });
});
