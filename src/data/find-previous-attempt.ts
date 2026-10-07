import { type CoreApiClient } from 'twenty-client-sdk/core';

import { DOCUMENT_STATUS } from 'src/constants/document-status';
import { findAssinafyDocuments } from 'src/data/find-assinafy-documents';
import { recordLinkFilter } from 'src/data/record-link-filter';
import { type AssinafyDocumentRecord } from 'src/types/assinafy-document-record';

// A send of the same document name to the same record, created since `since`, that did not fail.
export const findPreviousAttempt = async (
  core: CoreApiClient,
  { recordId, name, since }: { recordId: string; name: string; since: Date },
): Promise<AssinafyDocumentRecord | null> => {
  const [previous] = await findAssinafyDocuments(core, {
    filter: {
      ...recordLinkFilter(recordId),
      name: { eq: name },
      status: { neq: DOCUMENT_STATUS.FAILED },
      createdAt: { gte: since.toISOString() },
    },
    first: 1,
  });
  return previous ?? null;
};
