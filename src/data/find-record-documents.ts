import { type CoreApiClient } from 'twenty-client-sdk/core';

import { findAssinafyDocuments } from 'src/data/find-assinafy-documents';
import { recordLinkFilter } from 'src/data/record-link-filter';
import { type AssinafyDocumentRecord } from 'src/types/assinafy-document-record';

const RECORD_DOCUMENTS_LIMIT = 50;

export const findRecordDocuments = (core: CoreApiClient, recordId: string): Promise<AssinafyDocumentRecord[]> =>
  findAssinafyDocuments(core, {
    filter: recordLinkFilter(recordId),
    orderBy: [{ createdAt: 'DescNullsLast' }],
    first: RECORD_DOCUMENTS_LIMIT,
  });
