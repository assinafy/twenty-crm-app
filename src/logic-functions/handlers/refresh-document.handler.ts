import { selectDocumentCredential } from 'src/assinafy-client/select-document-credential';
import { DOCUMENT_STATUS } from 'src/constants/document-status';
import { requireAssinafyDocument } from 'src/data/require-assinafy-document';
import { syncAssinafyDocument } from 'src/services/sync-assinafy-document.service';
import { type DocumentSummary } from 'src/types/document-summary';
import { type MemberHandlerContext } from 'src/types/member-handler-context';
import { isSendLeaseActive } from 'src/utils/is-send-lease-active.util';
import { toDocumentSummary } from 'src/utils/to-document-summary.util';

export const refreshDocumentHandler = async (
  input: { documentRecordId: string },
  ctx: MemberHandlerContext,
): Promise<DocumentSummary> => {
  // Read as the member: they only refresh documents their role lets them see.
  const record = await requireAssinafyDocument(ctx.userCore, input.documentRecordId);

  // Without an Assinafy document there is nothing to read, except a send that died mid-way (sync marks it UNCERTAIN).
  // A FAILED send never changes, and a read would only replace why it failed (its upload is purged after 24 h).
  const abandonedSend = record.status === DOCUMENT_STATUS.SENDING && !isSendLeaseActive(record, ctx.now());
  if (
    record.assinafyAccountId === null ||
    record.status === DOCUMENT_STATUS.FAILED ||
    (record.assinafyDocumentId === null && !abandonedSend)
  ) {
    return toDocumentSummary(record);
  }
  // An abandoned send without a document settles without an Assinafy call, so it needs no credential.
  if (record.assinafyDocumentId === null) {
    return toDocumentSummary(await syncAssinafyDocument(ctx, record, null));
  }

  const resolved = await selectDocumentCredential(ctx, record.assinafyAccountId);

  return toDocumentSummary(await syncAssinafyDocument(ctx, record, resolved));
};
