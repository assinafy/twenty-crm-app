import { type CoreApiClient } from 'twenty-client-sdk/core';

import { ASSINAFY_DOCUMENT_SELECTION } from 'src/data/assinafy-document-selection';
import { hasGraphqlErrorCode } from 'src/data/has-graphql-error-code';
import { toAssinafyDocumentInput } from 'src/data/to-assinafy-document-input';
import { toAssinafyDocumentRecord } from 'src/data/to-assinafy-document-record';
import { type AssinafyDocumentNode } from 'src/types/assinafy-document-node';
import { type AssinafyDocumentPatch } from 'src/types/assinafy-document-patch';
import { type AssinafyDocumentRecord } from 'src/types/assinafy-document-record';
import { AppFailure } from 'src/utils/app-failure.util';

export const updateAssinafyDocument = async (
  core: CoreApiClient,
  id: string,
  patch: AssinafyDocumentPatch,
): Promise<AssinafyDocumentRecord> => {
  const node = await core
    .mutation({
      updateAssinafyDocument: { __args: { id, data: toAssinafyDocumentInput(patch) }, ...ASSINAFY_DOCUMENT_SELECTION },
    })
    .then(
      (result: { updateAssinafyDocument?: AssinafyDocumentNode | null }) => result.updateAssinafyDocument,
      (error: unknown) => {
        // Twenty 2.42 fails an update of a missing (or deleted) record with extensions { code: 'NOT_FOUND',
        // subCode: 'RECORD_NOT_FOUND' } instead of returning null; both cases become NOT_FOUND below. Any other
        // error (e.g. a permission denial) reaches the caller unchanged.
        if (hasGraphqlErrorCode(error, 'NOT_FOUND')) {
          return null;
        }
        throw error;
      },
    );

  if (!node) {
    throw new AppFailure('NOT_FOUND', 'Documento não encontrado.');
  }

  return toAssinafyDocumentRecord(node);
};
