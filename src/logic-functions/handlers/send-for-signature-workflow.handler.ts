import { selectWorkflowCredential } from 'src/assinafy-client/select-workflow-credential';
import { DOCUMENT_STATUS } from 'src/constants/document-status';
import {
  BILLABLE_CALL_BUDGET_MS,
  DAY_MS,
  MAX_NAME_LENGTH,
  SEND_LEASE_MS,
  SEND_TIMEOUT_SECONDS,
} from 'src/constants/limits';
import { findAssinafyDocumentByRequestId } from 'src/data/find-assinafy-document-by-request-id';
import { findAttachmentFile } from 'src/data/find-attachment-file';
import { findContacts } from 'src/data/find-contacts';
import { findCrmRecord } from 'src/data/find-crm-record';
import { findPreviousAttempt } from 'src/data/find-previous-attempt';
import { deleteUnsentUpload } from 'src/services/delete-unsent-upload.service';
import { listTemplateSummaries } from 'src/services/list-template-summaries.service';
import { prepareSignatureRequest } from 'src/services/prepare-signature-request.service';
import { sendSignatureRequest } from 'src/services/send-signature-request.service';
import { type AppErrorCode } from 'src/types/app-error-code';
import { type AssinafyDocumentRecord } from 'src/types/assinafy-document-record';
import { type CrmRecord } from 'src/types/crm-record';
import { type DocumentStatus } from 'src/types/document-status';
import { type HandlerContext } from 'src/types/handler-context';
import { type ResolvedCredential } from 'src/types/resolved-credential';
import { type SignatureRequestInput } from 'src/types/signature-request-input';
import { type WorkflowSendInput } from 'src/types/workflow-send-input';
import { AppFailure } from 'src/utils/app-failure.util';
import { assertWithinCreditLimit } from 'src/utils/assert-within-credit-limit.util';
import { describeWorkflowError } from 'src/utils/describe-workflow-error.util';
import { invalidInput } from 'src/utils/invalid-input.util';
import { parseWorkflowSendInput } from 'src/utils/parse-workflow-send-input.util';
import { toAppResult } from 'src/utils/to-app-result.util';
import { validateSigners } from 'src/utils/validate-signers.util';

type WorkflowSendOutput = {
  ok: boolean;
  documentRecordId: string | null;
  status: DocumentStatus | null;
  errorCode: AppErrorCode | null;
  errorMessage: string | null;
};

// Twenty starts the function timer before the handler runs; this margin covers that start.
const DEADLINE_MARGIN_MS = 10_000;
const PREVIOUS_ATTEMPT_MESSAGE =
  'Uma tentativa anterior pode ter enviado esta solicitação. Confira na Assinafy antes de executar novamente.';

const findRecord = async (ctx: HandlerContext, input: WorkflowSendInput): Promise<CrmRecord> => {
  // The document links to one record: the most specific one given.
  const recordId = input.opportunityId ?? input.personId ?? input.companyId ?? '';
  const record = await findCrmRecord(ctx.appCore, recordId);
  if (!record) throw invalidInput('record', 'not_found');
  return record;
};

const buildRequest = async (
  ctx: HandlerContext,
  input: WorkflowSendInput,
  resolved: ResolvedCredential,
): Promise<SignatureRequestInput> => {
  const record = await findRecord(ctx, input);
  const contacts = await findContacts(ctx.appCore, input.signerPersonIds);
  const missing = input.signerPersonIds.findIndex((id) => !contacts.some((contact) => contact.personId === id));
  if (missing !== -1) throw invalidInput('signers', 'not_found', missing);

  let source: SignatureRequestInput['source'];
  let defaultName: string;
  let roleIds: Array<string | null> = contacts.map(() => null);

  if (input.attachmentId !== null) {
    const file = await findAttachmentFile(ctx.appCore, record, input.attachmentId);
    if (!file) throw invalidInput('attachment', 'not_found');
    source = { type: 'PDF', attachmentId: input.attachmentId };
    defaultName = file.name.replace(/\.pdf$/i, '');
  } else {
    const templates = await listTemplateSummaries(resolved.client);
    const template = templates.find((candidate) => candidate.id === input.templateId);
    if (!template) throw invalidInput('templateId', 'not_found');
    // Signers fill the template's signer roles in order.
    if (template.signerRoles.length !== contacts.length) throw invalidInput('signers', 'role_count');
    source = { type: 'TEMPLATE', templateId: template.id, editorFields: [] };
    defaultName = template.documentName ?? template.name;
    roleIds = template.signerRoles.map((role) => role.id);
  }

  const signers = validateSigners(
    contacts.map((contact, index) => ({
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      verificationMethod: input.verificationMethod,
      roleId: roleIds[index],
    })),
    { source: source.type },
  );

  return {
    recordId: record.id,
    source,
    name: input.name ?? (defaultName.trim().slice(0, MAX_NAME_LENGTH) || 'Documento'),
    signers,
    message: input.message,
    expiresAt:
      input.expiresInDays === null ? null : new Date(ctx.now().getTime() + input.expiresInDays * DAY_MS).toISOString(),
    sequential: false,
    assinafyDocumentId: null,
  };
};

const cleanUpUpload = async (
  ctx: HandlerContext,
  resolved: ResolvedCredential,
  documentId: string,
): Promise<void> => {
  try {
    await deleteUnsentUpload(resolved, documentId, ctx.appCore);
  } catch (error) {
    console.warn('[assinafy] send-for-signature-workflow cleanup failed', {
      code: error instanceof AppFailure ? error.code : 'INTERNAL',
    });
  }
};

// Workflow action: prepare and send in one run, within the configured credit ceiling. Never throws: later steps branch
// on the output. The send refuses to start its billable call when the call could outlive the function timeout, so the
// platform never kills a run during or after it.
export const sendForSignatureWorkflowHandler = async (
  payload: unknown,
  ctx: HandlerContext,
  retryCount: number,
): Promise<WorkflowSendOutput> => {
  const deadlineMs = ctx.now().getTime() + SEND_TIMEOUT_SECONDS * 1000 - DEADLINE_MARGIN_MS;

  // Twenty passes a retry count only to job-runner triggers, never to workflow steps (see the previous-attempt check
  // below); kept in case this function ever runs through one.
  if (retryCount > 0) {
    return { ok: false, documentRecordId: null, status: null, errorCode: 'UNCERTAIN', errorMessage: PREVIOUS_ATTEMPT_MESSAGE };
  }

  // No person: every Twenty read and write acts as the application.
  const appCtx: HandlerContext = { ...ctx, userCore: ctx.appCore };
  const requestId = crypto.randomUUID();
  const attempt: {
    previous: AssinafyDocumentRecord | null;
    upload: { resolved: ResolvedCredential; documentId: string } | null;
  } = { previous: null, upload: null };

  const result = await toAppResult('send-for-signature-workflow', async () => {
    const input = parseWorkflowSendInput(payload);
    const resolved = await selectWorkflowCredential(appCtx);
    const request = await buildRequest(appCtx, input, resolved);

    // Twenty re-runs a failed workflow step ("Tentar novamente em caso de falha") seconds later with retryCount 0, and
    // a run the platform killed may already have made its billable call. A send of the same document to the same
    // record that did not fail, within the send lease, is taken as that earlier attempt.
    attempt.previous = await findPreviousAttempt(appCtx.appCore, {
      recordId: request.recordId,
      name: request.name,
      since: new Date(appCtx.now().getTime() - SEND_LEASE_MS),
    });
    if (attempt.previous) throw new AppFailure('UNCERTAIN', PREVIOUS_ATTEMPT_MESSAGE);

    const prepared = await prepareSignatureRequest(appCtx, request, resolved).catch((error: unknown) => {
      // An estimate that failed after the upload names it.
      const documentId = error instanceof AppFailure ? error.details?.assinafyDocumentId : undefined;
      if (typeof documentId === 'string') attempt.upload = { resolved, documentId };
      throw error;
    });
    if (prepared.assinafyDocumentId !== null) attempt.upload = { resolved, documentId: prepared.assinafyDocumentId };

    assertWithinCreditLimit(prepared.estimate, input.maxCredits);

    return sendSignatureRequest(
      appCtx,
      {
        ...request,
        assinafyDocumentId: prepared.assinafyDocumentId,
        requestId,
        accountId: prepared.accountId,
        expectedTotalCredits: prepared.estimate.totalCredits,
        expectedDocuments: prepared.estimate.documents,
        deadlineMs,
      },
      resolved,
    );
  });

  if (result.ok) {
    return {
      ok: true,
      documentRecordId: result.documentRecordId,
      status: result.status,
      errorCode: null,
      errorMessage: null,
    };
  }

  // A failed or uncertain send leaves a record later steps can point to.
  let lookupFailed = false;
  const record =
    attempt.previous ??
    (await findAssinafyDocumentByRequestId(ctx.appCore, requestId).catch(() => {
      lookupFailed = true;
      return null;
    }));

  // No claim, or a claim that failed definitively: the upload was never assigned and nothing will send it. An
  // UNCERTAIN claim keeps it, and so does a run too close to its deadline (the pending-upload purge deletes it later).
  if (
    attempt.upload !== null &&
    !lookupFailed &&
    (record === null || record.status === DOCUMENT_STATUS.FAILED) &&
    ctx.now().getTime() + BILLABLE_CALL_BUDGET_MS <= deadlineMs
  ) {
    await cleanUpUpload(appCtx, attempt.upload.resolved, attempt.upload.documentId);
  }

  return {
    ok: false,
    documentRecordId: record?.id ?? null,
    status: record?.status ?? null,
    errorCode: result.error.code,
    errorMessage: describeWorkflowError(result.error),
  };
};
