import { type CoreApiClient } from 'twenty-client-sdk/core';

import { DOCUMENT_STATUS } from 'src/constants/document-status';
import { findAssinafyDocuments } from 'src/data/find-assinafy-documents';
import { type AssinafyDocumentRecord } from 'src/types/assinafy-document-record';

// The record, other than a FAILED send, that points at the upload: a SENDING or UNCERTAIN send may still assign it.
// Deleters pass the application client so the member's record permissions cannot hide one; the send passes the
// member's client so it only returns a record the member can see.
export const findUploadReference = async (
  core: CoreApiClient,
  documentId: string,
): Promise<AssinafyDocumentRecord | null> => {
  const [record] = await findAssinafyDocuments(core, {
    filter: {
      assinafyDocumentId: { eq: documentId },
      or: [{ status: { neq: DOCUMENT_STATUS.FAILED } }, { status: { is: 'NULL' } }],
    },
    first: 1,
  });
  return record ?? null;
};
