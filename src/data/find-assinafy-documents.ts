import { type CoreApiClient } from 'twenty-client-sdk/core';

import { ASSINAFY_DOCUMENT_SELECTION } from 'src/data/assinafy-document-selection';
import { toAssinafyDocumentRecord } from 'src/data/to-assinafy-document-record';
import { type AssinafyDocumentFilter } from 'src/types/assinafy-document-filter';
import { type AssinafyDocumentNode } from 'src/types/assinafy-document-node';
import { type AssinafyDocumentRecord } from 'src/types/assinafy-document-record';
import { type OrderByDirection } from 'src/types/order-by-direction';
import { type RecordConnection } from 'src/types/record-connection';

export const findAssinafyDocuments = async (
  core: CoreApiClient,
  args: {
    filter: AssinafyDocumentFilter;
    orderBy?: Array<{ createdAt?: OrderByDirection; sentAt?: OrderByDirection; lastSyncedAt?: OrderByDirection }>;
    first: number;
  },
): Promise<AssinafyDocumentRecord[]> => {
  const { assinafyDocuments }: { assinafyDocuments?: RecordConnection<AssinafyDocumentNode> | null } =
    await core.query({
      assinafyDocuments: { __args: args, edges: { node: ASSINAFY_DOCUMENT_SELECTION } },
    });

  return (assinafyDocuments?.edges ?? []).map(({ node }) => toAssinafyDocumentRecord(node));
};
