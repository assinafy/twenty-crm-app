import { type CoreApiClient } from 'twenty-client-sdk/core';

import { findAssinafyDocuments } from 'src/data/find-assinafy-documents';
import { type AssinafyDocumentRecord } from 'src/types/assinafy-document-record';

// A filtered list instead of the singular lookup, which fails instead of returning null when nothing matches.
export const findAssinafyDocument = async (
  core: CoreApiClient,
  id: string,
): Promise<AssinafyDocumentRecord | null> =>
  (await findAssinafyDocuments(core, { filter: { id: { eq: id } }, first: 1 }))[0] ?? null;
