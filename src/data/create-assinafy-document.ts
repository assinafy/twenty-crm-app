import { type CoreApiClient } from 'twenty-client-sdk/core';

import { ASSINAFY_DOCUMENT_SELECTION } from 'src/data/assinafy-document-selection';
import { toAssinafyDocumentInput } from 'src/data/to-assinafy-document-input';
import { toAssinafyDocumentRecord } from 'src/data/to-assinafy-document-record';
import { type AssinafyDocumentPatch } from 'src/types/assinafy-document-patch';
import { type AssinafyDocumentRecord } from 'src/types/assinafy-document-record';
import { type DocumentStatus } from 'src/types/document-status';
import { AppFailure } from 'src/utils/app-failure.util';

// A duplicate requestId rejects with a unique violation (see isUniqueViolation).
export const createAssinafyDocument = async (
  core: CoreApiClient,
  data: AssinafyDocumentPatch & {
    name: string;
    status: DocumentStatus;
    requestId: string;
    personId?: string | null;
    companyId?: string | null;
    opportunityId?: string | null;
  },
): Promise<AssinafyDocumentRecord> => {
  const { createAssinafyDocument: node } = await core.mutation({
    createAssinafyDocument: { __args: { data: toAssinafyDocumentInput(data) }, ...ASSINAFY_DOCUMENT_SELECTION },
  });

  if (!node) {
    throw new AppFailure('INTERNAL', 'O Twenty não retornou o documento criado.');
  }

  return toAssinafyDocumentRecord(node);
};
