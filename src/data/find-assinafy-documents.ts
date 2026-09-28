import { type CoreApiClient, type CoreSchema } from 'twenty-client-sdk/core';

import { ASSINAFY_DOCUMENT_SELECTION } from 'src/data/assinafy-document-selection';
import { toAssinafyDocumentRecord } from 'src/data/to-assinafy-document-record';
import { type AssinafyDocumentRecord } from 'src/types/assinafy-document-record';

export const findAssinafyDocuments = async (
  core: CoreApiClient,
  args: {
    filter: CoreSchema.AssinafyDocumentFilterInput;
    orderBy?: CoreSchema.AssinafyDocumentOrderByInput[];
    first: number;
  },
): Promise<AssinafyDocumentRecord[]> => {
  const { assinafyDocuments } = await core.query({
    assinafyDocuments: { __args: args, edges: { node: ASSINAFY_DOCUMENT_SELECTION } },
  });

  return (assinafyDocuments?.edges ?? []).map(({ node }) => toAssinafyDocumentRecord(node));
};
