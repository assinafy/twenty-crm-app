import { type CoreApiClient } from 'twenty-client-sdk/core';

import { findAssinafyDocuments } from 'src/data/find-assinafy-documents';
import { type AssinafyDocumentRecord } from 'src/types/assinafy-document-record';

// Contract terms can change long after signature certification, independently of the signature sync window.
export const findContractsToSync = (core: CoreApiClient, limit: number): Promise<AssinafyDocumentRecord[]> =>
  findAssinafyDocuments(core, {
    filter: {
      contractStatus: { is: 'NOT_NULL' },
      and: [
        { assinafyDocumentId: { is: 'NOT_NULL' } },
        { assinafyDocumentId: { neq: '' } },
        { assinafyAccountId: { is: 'NOT_NULL' } },
        { assinafyAccountId: { neq: '' } },
      ],
    },
    orderBy: [{ contractSyncedAt: 'AscNullsFirst' }],
    first: limit,
  });
