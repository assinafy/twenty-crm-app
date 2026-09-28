import { type CoreApiClient } from 'twenty-client-sdk/core';

import { DOCUMENT_STATUS, SYNCABLE_DOCUMENT_STATUSES } from 'src/constants/document-status';
import { DAY_MS, SEND_LEASE_MS, SYNC_WINDOW_DAYS } from 'src/constants/limits';
import { findAssinafyDocuments } from 'src/data/find-assinafy-documents';
import { type AssinafyDocumentRecord } from 'src/types/assinafy-document-record';
import { type DocumentStatus } from 'src/types/document-status';

// Oldest-checked first so a batch limit rotates through every open document.
export const findSyncableAssinafyDocuments = (
  core: CoreApiClient,
  { now, limit }: { now: Date; limit: number },
): Promise<AssinafyDocumentRecord[]> => {
  const leaseExpiredBefore = new Date(now.getTime() - SEND_LEASE_MS).toISOString();
  // Start of the sync window: sentAt for confirmed sends, createdAt (the claim) for unconfirmed ones.
  const windowStart = new Date(now.getTime() - SYNC_WINDOW_DAYS * DAY_MS).toISOString();

  return findAssinafyDocuments(core, {
    filter: {
      and: [
        {
          or: [
            { status: { in: SYNCABLE_DOCUMENT_STATUSES as DocumentStatus[] } },
            { status: { eq: DOCUMENT_STATUS.UNCERTAIN }, assinafyDocumentId: { is: 'NOT_NULL' } },
            { status: { eq: DOCUMENT_STATUS.SENDING }, updatedAt: { lt: leaseExpiredBefore } },
          ],
        },
        {
          or: [
            { sentAt: { gte: windowStart } },
            // UNCERTAIN and SENDING records were never confirmed as sent.
            {
              sentAt: { is: 'NULL' },
              status: { in: [DOCUMENT_STATUS.UNCERTAIN, DOCUMENT_STATUS.SENDING] },
              createdAt: { gte: windowStart },
            },
          ],
        },
      ],
    },
    orderBy: [{ lastSyncedAt: 'AscNullsFirst' }],
    first: limit,
  });
};
