import { type CoreApiClient } from 'twenty-client-sdk/core';

import { findAssinafyDocuments } from 'src/data/find-assinafy-documents';
import { type AssinafyDocumentRecord } from 'src/types/assinafy-document-record';

export const findAssinafyDocumentByRequestId = async (
  core: CoreApiClient,
  requestId: string,
): Promise<AssinafyDocumentRecord | null> =>
  (await findAssinafyDocuments(core, { filter: { requestId: { eq: requestId } }, first: 1 }))[0] ?? null;
