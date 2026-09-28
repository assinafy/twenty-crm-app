import { type IAssignment, type IDocumentDetailsResponse } from '@assinafy/sdk';

import { selectSendCredential } from 'src/assinafy-client/select-send-credential';
import { DOCUMENT_STATUS } from 'src/constants/document-status';
import { BILLABLE_CALL_BUDGET_MS, SEND_MIN_EXPIRATION_MINUTES } from 'src/constants/limits';
import { createAssinafyDocument } from 'src/data/create-assinafy-document';
import { findAssinafyDocumentByRequestId } from 'src/data/find-assinafy-document-by-request-id';
import { findCrmRecord } from 'src/data/find-crm-record';
import { findUploadReference } from 'src/data/find-upload-reference';
import { isPermissionDenied } from 'src/data/is-permission-denied';
import { isUniqueViolation } from 'src/data/is-unique-violation';
import { updateAssinafyDocument } from 'src/data/update-assinafy-document';
import { assertSendableUpload } from 'src/services/assert-sendable-upload.service';
import { estimateSignatureRequest } from 'src/services/estimate-signature-request.service';
import { findSignatureTemplate } from 'src/services/find-signature-template.service';
import { forgetPendingUpload } from 'src/services/forget-pending-upload.service';
import { upsertSigners } from 'src/services/upsert-signers.service';
import { type AssinafyDocumentPatch } from 'src/types/assinafy-document-patch';
import { type AssinafyDocumentRecord } from 'src/types/assinafy-document-record';
import { type DocumentSummary } from 'src/types/document-summary';
import { type HandlerContext } from 'src/types/handler-context';
import { type ResolvedCredential } from 'src/types/resolved-credential';
import { type SendSignatureRequestInput } from 'src/types/send-signature-request-input';
import { AppFailure } from 'src/utils/app-failure.util';
import { assertEstimateUnchanged } from 'src/utils/assert-estimate-unchanged.util';
import { assertReusableUpload } from 'src/utils/assert-reusable-upload.util';
import { billable } from 'src/utils/billable.util';
import { buildAssignmentSigners } from 'src/utils/build-assignment-signers.util';
import { buildTemplateSigners } from 'src/utils/build-template-signers.util';
import { cannotCreateDocuments } from 'src/utils/cannot-create-documents.util';
import { errorName } from 'src/utils/error-name.util';
import { invalidInput } from 'src/utils/invalid-input.util';
import { isAssinafyId } from 'src/utils/is-assinafy-id.util';
import { mapAssignmentSigners } from 'src/utils/map-assignment-signers.util';
import { toAppError } from 'src/utils/to-app-error.util';
import { toDocumentSummary } from 'src/utils/to-document-summary.util';
import { validateExpiresAt } from 'src/utils/validate-expires-at.util';

type Delivery = { documentId: string; assignment: IAssignment | null };

const workspaceChanged = (): AppFailure =>
  new AppFailure('INVALID_STATE', 'O workspace da Assinafy mudou. Revise a solicitação novamente.');

// Returns the record the member can see for an upload that was already sent (a send whose answer was lost and that
// is retried under a new requestId; a FAILED attempt is never returned); an upload nobody here sent is never attached
// to a new record. A member otherwise sends only their own, recent enough upload (assertSendableUpload).
const assertUnsentUpload = async (
  ctx: Pick<HandlerContext, 'userCore' | 'userWorkspaceId' | 'now'>,
  { client, accountId }: ResolvedCredential,
  documentId: string,
  member: boolean,
): Promise<DocumentSummary | null> => {
  let details: IDocumentDetailsResponse;
  try {
    details = await client.documents.details(documentId);
  } catch (error) {
    throw toAppError(error, 'read');
  }
  if (details.account_id !== accountId) {
    throw workspaceChanged();
  }
  if (details.assignment) {
    const existing = await findUploadReference(ctx.userCore, documentId);
    if (existing) {
      return toDocumentSummary(existing);
    }
  }
  // After the lookup above: a sent upload's entry is already forgotten, and its retry must still get the record.
  if (member) {
    await assertSendableUpload(documentId, accountId, ctx.userWorkspaceId, ctx.now());
  }
  assertReusableUpload(details, accountId);
  return null;
};

// Everything that cannot send or charge: runs before the SENDING record is claimed, so a changed price, an
// insufficient balance or an upload that was already sent never leaves a record (or a timeline entry) behind.
const checkBeforeClaim = async (
  ctx: Pick<HandlerContext, 'now' | 'userCore' | 'userWorkspaceId'>,
  input: SendSignatureRequestInput,
  resolved: ResolvedCredential,
  documentId: string | null,
  member: boolean,
): Promise<DocumentSummary | null> => {
  validateExpiresAt(input.expiresAt, ctx.now(), SEND_MIN_EXPIRATION_MINUTES);

  if (documentId !== null) {
    const alreadySent = await assertUnsentUpload(ctx, resolved, documentId, member);
    if (alreadySent) {
      return alreadySent;
    }
  }

  assertEstimateUnchanged(await estimateSignatureRequest(resolved, input, documentId), {
    totalCredits: input.expectedTotalCredits,
    documents: input.expectedDocuments,
  });
  return null;
};

// A run that may be killed at deadlineMs never starts a billable call that could outlive it: a call that starts
// always settles (sent, rejected, or UNCERTAIN on its own timeout) and is recorded before the run ends.
const assertTimeForBillableCall = (ctx: Pick<HandlerContext, 'now'>, deadlineMs: number | undefined): void => {
  if (deadlineMs !== undefined && ctx.now().getTime() + BILLABLE_CALL_BUDGET_MS > deadlineMs) {
    throw new AppFailure(
      'PROVIDER_UNAVAILABLE',
      'Não houve tempo para concluir o envio nesta execução. Nada foi enviado; tente novamente.',
    );
  }
};

const deliver = async (
  ctx: Pick<HandlerContext, 'now'>,
  input: SendSignatureRequestInput,
  resolved: ResolvedCredential,
  documentId: string | null,
): Promise<Delivery> => {
  const { source } = input;
  const signers = await upsertSigners(resolved.client, input.signers);
  assertTimeForBillableCall(ctx, input.deadlineMs);
  const options = {
    ...(input.message === null ? {} : { message: input.message }),
    ...(input.expiresAt === null ? {} : { expires_at: input.expiresAt }),
  };

  // Payloads are built before the billable call, so a local error is never mistaken for an unconfirmed send.
  if (source.type === 'TEMPLATE') {
    const templateSigners = buildTemplateSigners(signers, input.sequential);
    const editorFields = source.editorFields.map(({ fieldId, value }) => ({ field_id: fieldId, value }));
    // The response is read inside the billable call: an unexpected body must not read as a definitive rejection.
    return billable(async () => {
      const created = await resolved.client.documents.createFromTemplate(source.templateId, templateSigners, {
        name: input.name,
        ...options,
        ...(editorFields.length > 0 ? { editor_fields: editorFields } : {}),
      });
      // A 2xx without a usable document id cannot be tracked: it is recorded as unconfirmed, never as pending.
      const id: unknown = (created as { id?: unknown } | null | undefined)?.id;
      if (typeof id !== 'string' || !isAssinafyId(id)) {
        throw new TypeError('createFromTemplate answered without a document id');
      }
      return { documentId: id, assignment: created.assignment ?? null };
    });
  }

  if (documentId === null) {
    throw new AppFailure('INTERNAL', 'O envio de um PDF exige o documento carregado.');
  }
  const payload = { method: 'virtual' as const, signers: buildAssignmentSigners(signers, input.sequential), ...options };
  const assignment = await billable(() => resolved.client.assignments.create(documentId, payload));
  return { documentId, assignment };
};

// The request is out: a failed Twenty write must not report it as failed (the user would send it again).
const recordDelivery = async (
  ctx: Pick<HandlerContext, 'appCore' | 'now'>,
  sending: AssinafyDocumentRecord,
  delivery: Delivery,
): Promise<DocumentSummary> => {
  const patch: AssinafyDocumentPatch = {
    status: DOCUMENT_STATUS.PENDING_SIGNATURE,
    sentAt: ctx.now().toISOString(),
    assinafyDocumentId: delivery.documentId,
    assinafyAssignmentId: delivery.assignment?.id ?? null,
    signers: mapAssignmentSigners(delivery.assignment, null),
    lastError: null,
  };

  // One retry: a record left SENDING would later be marked "Check in Assinafy" although the request went out.
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return toDocumentSummary(await updateAssinafyDocument(ctx.appCore, sending.id, patch));
    } catch (error) {
      console.error('[assinafy] recording a sent signature request failed', {
        attempt,
        name: errorName(error),
      });
    }
  }
  return toDocumentSummary({ ...sending, ...patch });
};

const recordFailure = async (
  ctx: Pick<HandlerContext, 'appCore'>,
  sending: AssinafyDocumentRecord,
  error: unknown,
): Promise<AppFailure> => {
  const failure = toAppError(error, 'read');
  try {
    await updateAssinafyDocument(ctx.appCore, sending.id, {
      status: failure.code === 'UNCERTAIN' ? DOCUMENT_STATUS.UNCERTAIN : DOCUMENT_STATUS.FAILED,
      lastError: failure.code,
    });
  } catch (updateError) {
    console.error('[assinafy] recording a failed signature request failed', {
      code: failure.code,
      name: errorName(updateError),
    });
  }
  // The claimed record stays for reconciliation; the front end offers to open it.
  return new AppFailure(failure.code, failure.message, { ...failure.details, documentRecordId: sending.id });
};

// Sends the reviewed request once per requestId: the SENDING record (unique requestId) is claimed before any billable
// call, so a retry or a concurrent click returns that document instead of sending again. `credential` is given by
// callers without a person (workflow), which cannot use the member's credential.
export const sendSignatureRequest = async (
  ctx: HandlerContext,
  input: SendSignatureRequestInput,
  credential?: ResolvedCredential,
): Promise<DocumentSummary> => {
  const record = await findCrmRecord(ctx.userCore, input.recordId);
  if (record === null) {
    throw new AppFailure('NOT_FOUND', 'O registro não está mais disponível.');
  }

  let existing: AssinafyDocumentRecord | null;
  try {
    existing = await findAssinafyDocumentByRequestId(ctx.userCore, input.requestId);
  } catch (error) {
    throw isPermissionDenied(error) ? cannotCreateDocuments() : error;
  }
  if (existing) {
    return toDocumentSummary(existing);
  }

  const resolved = credential ?? (await selectSendCredential(ctx));
  if (resolved.accountId !== input.accountId) {
    throw workspaceChanged();
  }

  const { source } = input;
  const documentId = source.type === 'PDF' ? input.assinafyDocumentId : null;
  if (source.type === 'PDF' && documentId === null) {
    throw invalidInput('assinafyDocumentId', 'required');
  }
  const template =
    source.type === 'TEMPLATE' ? await findSignatureTemplate(resolved.client, source, input.signers) : null;
  const alreadySent = await checkBeforeClaim(ctx, input, resolved, documentId, credential === undefined);
  if (alreadySent) {
    return alreadySent;
  }

  let sending: AssinafyDocumentRecord;
  try {
    sending = await createAssinafyDocument(ctx.userCore, {
      name: input.name,
      status: DOCUMENT_STATUS.SENDING,
      requestId: input.requestId,
      assinafyAccountId: resolved.accountId,
      assinafyDocumentId: documentId,
      templateName: template?.name ?? null,
      expiresAt: input.expiresAt,
      signerCount: input.signers.length,
      signedCount: 0,
      personId: record.objectNameSingular === 'person' ? record.id : null,
      companyId: record.objectNameSingular === 'company' ? record.id : null,
      opportunityId: record.objectNameSingular === 'opportunity' ? record.id : null,
    });
  } catch (error) {
    // Checked before anything billable ran: nothing was sent, so the member gets a definite answer.
    if (isPermissionDenied(error)) {
      throw cannotCreateDocuments();
    }
    const concurrent = isUniqueViolation(error)
      ? await findAssinafyDocumentByRequestId(ctx.userCore, input.requestId)
      : null;
    if (concurrent === null) {
      throw error;
    }
    return toDocumentSummary(concurrent);
  }

  let delivery: Delivery;
  try {
    delivery = await deliver(ctx, input, resolved, documentId);
  } catch (error) {
    // A FAILED or UNCERTAIN send keeps its pending upload: the purge deletes it once it is known to be unsent.
    throw await recordFailure(ctx, sending, error);
  }
  // The upload is sent: it is no longer a draft the purge may delete.
  if (documentId !== null) {
    await forgetPendingUpload(documentId);
  }
  return recordDelivery(ctx, sending, delivery);
};
