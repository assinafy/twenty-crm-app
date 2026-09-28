import { type IDocumentDetailsResponse } from '@assinafy/sdk';

import { selectSendCredential } from 'src/assinafy-client/select-send-credential';
import { findAttachmentFile } from 'src/data/find-attachment-file';
import { findCrmRecord } from 'src/data/find-crm-record';
import { assertSendableUpload } from 'src/services/assert-sendable-upload.service';
import { estimateSignatureRequest } from 'src/services/estimate-signature-request.service';
import { fetchAttachmentPdf } from 'src/services/fetch-attachment-pdf.service';
import { findSignatureTemplate } from 'src/services/find-signature-template.service';
import { rememberPendingUpload } from 'src/services/remember-pending-upload.service';
import { type CrmRecord } from 'src/types/crm-record';
import { type HandlerContext } from 'src/types/handler-context';
import { type PreparedSignatureRequest } from 'src/types/prepared-signature-request';
import { type ResolvedCredential } from 'src/types/resolved-credential';
import { type SignatureRequestInput } from 'src/types/signature-request-input';
import { AppFailure } from 'src/utils/app-failure.util';
import { assertReusableUpload } from 'src/utils/assert-reusable-upload.util';
import { toAppError } from 'src/utils/to-app-error.util';

type AttachmentPdf = Awaited<ReturnType<typeof fetchAttachmentPdf>>;

const readAttachmentPdf = async (
  ctx: Pick<HandlerContext, 'userCore'>,
  record: CrmRecord,
  attachmentId: string,
): Promise<AttachmentPdf> => {
  const file = await findAttachmentFile(ctx.userCore, record, attachmentId);
  if (file === null) {
    throw new AppFailure('NOT_FOUND', 'O anexo não está mais disponível neste registro.');
  }
  return fetchAttachmentPdf(file);
};

const uploadPdf = async (
  resolved: ResolvedCredential,
  pdf: AttachmentPdf,
  name: string,
  now: Date,
  userWorkspaceId: string | null,
): Promise<string> => {
  let documentId: string;
  try {
    documentId = (await resolved.client.documents.upload(pdf, { name })).id;
  } catch (error) {
    throw toAppError(error, 'mutation');
  }

  await rememberPendingUpload({ documentId, accountId: resolved.accountId, userWorkspaceId }, now);
  return documentId;
};

const toPrepared = (
  resolved: ResolvedCredential,
  assinafyDocumentId: string | null,
  estimate: PreparedSignatureRequest['estimate'],
): PreparedSignatureRequest => ({
  accountId: resolved.accountId,
  accountName: resolved.accountName,
  assinafyDocumentId,
  estimate,
});

// Estimates the request; a PDF is uploaded first (once: a later prepare passes the upload back). Writes nothing to
// Twenty. `credential` is given by callers without a person (workflow), which cannot use the member's credential.
export const prepareSignatureRequest = async (
  ctx: HandlerContext,
  input: SignatureRequestInput,
  credential?: ResolvedCredential,
): Promise<PreparedSignatureRequest> => {
  const record = await findCrmRecord(ctx.userCore, input.recordId);
  if (record === null) {
    throw new AppFailure('NOT_FOUND', 'O registro não está mais disponível.');
  }

  const { source } = input;
  if (source.type === 'TEMPLATE') {
    const resolved = credential ?? (await selectSendCredential(ctx));
    await findSignatureTemplate(resolved.client, source, input.signers);
    return toPrepared(resolved, null, await estimateSignatureRequest(resolved, input, null));
  }

  if (input.assinafyDocumentId !== null) {
    const documentId = input.assinafyDocumentId;
    const resolved = credential ?? (await selectSendCredential(ctx));
    // A member reuses only an upload they prepared here and the purge cannot delete before the send.
    if (!credential) {
      await assertSendableUpload(documentId, resolved.accountId, ctx.userWorkspaceId, ctx.now());
    }
    let details: IDocumentDetailsResponse;
    try {
      details = await resolved.client.documents.details(documentId);
    } catch (error) {
      throw toAppError(error, 'read');
    }
    assertReusableUpload(details, resolved.accountId);
    return toPrepared(resolved, documentId, await estimateSignatureRequest(resolved, input, documentId));
  }

  // Reading the Twenty file needs no Assinafy credential, so a bad attachment fails before any Assinafy call.
  const pdf = await readAttachmentPdf(ctx, record, source.attachmentId);
  const resolved = credential ?? (await selectSendCredential(ctx));
  // A workflow upload belongs to no member, so the discard route never accepts it.
  const documentId = await uploadPdf(resolved, pdf, input.name, ctx.now(), credential ? null : ctx.userWorkspaceId);
  try {
    return toPrepared(resolved, documentId, await estimateSignatureRequest(resolved, input, documentId));
  } catch (error) {
    // The front end reuses the upload on its next attempt instead of uploading the PDF again.
    const failure = toAppError(error, 'read');
    throw new AppFailure(failure.code, failure.message, {
      ...failure.details,
      assinafyDocumentId: documentId,
      accountId: resolved.accountId,
    });
  }
};
