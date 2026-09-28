import { type CoreApiClient } from 'twenty-client-sdk/core';

import { findAssinafyDocument } from 'src/data/find-assinafy-document';
import { type AssinafyDocumentRecord } from 'src/types/assinafy-document-record';
import { AppFailure } from 'src/utils/app-failure.util';

export const requireAssinafyDocument = async (core: CoreApiClient, id: string): Promise<AssinafyDocumentRecord> => {
  const record = await findAssinafyDocument(core, id);
  if (!record) throw new AppFailure('NOT_FOUND', 'Documento não encontrado.');
  return record;
};
