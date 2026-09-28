import { type CoreApiClient, type CoreSchema } from 'twenty-client-sdk/core';

import { DOCUMENT_STATUS } from 'src/constants/document-status';
import { MAX_RECENT_SENDS } from 'src/constants/limits';
import { recordLinkFilter } from 'src/data/record-link-filter';
import { type RecentSend } from 'src/types/recent-send';

// Every status but FAILED, which records a send that never reached Assinafy.
const MAYBE_SENT_STATUSES = Object.values(DOCUMENT_STATUS).filter((status) => status !== DOCUMENT_STATUS.FAILED);

// The record's documents created since `since` that may have reached the signers, newest first. Selects only what the
// review step shows, so a field the member's role hides cannot fail the read.
export const findRecentSends = async (core: CoreApiClient, recordId: string, since: Date): Promise<RecentSend[]> => {
  const { assinafyDocuments } = await core.query({
    assinafyDocuments: {
      __args: {
        filter: {
          and: [
            recordLinkFilter(recordId),
            { status: { in: MAYBE_SENT_STATUSES as CoreSchema.AssinafyDocumentStatusEnum[] } },
            { createdAt: { gte: since.toISOString() } },
          ],
        },
        orderBy: [{ createdAt: 'DescNullsLast' }],
        first: MAX_RECENT_SENDS,
      },
      edges: { node: { id: true, name: true, status: true } },
    },
  });

  // Twenty returns unset TEXT fields as '' (see toAssinafyDocumentRecord).
  return (assinafyDocuments?.edges ?? []).map(({ node }) => ({
    documentRecordId: node.id,
    name: node.name || null,
    status: node.status || null,
  }));
};
