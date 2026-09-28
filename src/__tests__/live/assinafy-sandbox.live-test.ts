import { randomUUID } from 'node:crypto';

import { ApiError, MAX_LIST_PAGE_SIZE } from '@assinafy/sdk';
import { type CoreApiClient } from 'twenty-client-sdk/core';
import { type MetadataApiClient } from 'twenty-client-sdk/metadata';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const { kv } = await vi.hoisted(async () => (await import('src/services/__tests__/kv-store')).createKvStore());

vi.mock('twenty-sdk/logic-function', () => ({
  kv,
  reportConnectionAuthFailure: vi.fn<() => Promise<void>>(),
  listConnections: () => {
    throw new Error('The live suite passes its credential explicitly.');
  },
}));
vi.mock('src/assinafy-client/create-assinafy-client', () => ({
  createAssinafyClient: () => {
    throw new Error('The live suite never builds a production Assinafy client.');
  },
}));
vi.mock('src/assinafy-client/list-interactive-credentials', async () => {
  const { readSandboxEnv } = await import('src/__tests__/live/sandbox');
  return { listInteractiveCredentials: async () => [readSandboxEnv().credential] };
});
vi.mock('src/data/find-crm-record', () => import('src/__tests__/live/fake-twenty'));
vi.mock('src/data/find-attachment-file', () => import('src/__tests__/live/fake-twenty'));
vi.mock('src/data/find-assinafy-documents', () => import('src/__tests__/live/fake-twenty'));
vi.mock('src/data/create-assinafy-document', () => import('src/__tests__/live/fake-twenty'));
vi.mock('src/data/update-assinafy-document', () => import('src/__tests__/live/fake-twenty'));
vi.mock('src/data/upload-signed-file', () => import('src/__tests__/live/fake-twenty'));

import { buildPdf } from 'src/__tests__/fixtures/build-pdf';
import { buildSignerInput } from 'src/__tests__/fixtures/build-signer-input';
import { SANDBOX_BASE_URL } from 'src/__tests__/fixtures/sandbox-base-url';
import {
  ATTACHMENT,
  CRM_RECORD,
  createAssinafyDocument,
  records,
  signedFiles,
} from 'src/__tests__/live/fake-twenty';
import {
  createSandboxClient,
  httpExchanges,
  lastStatus,
  readSandboxEnv,
  report,
  shortDeadline,
} from 'src/__tests__/live/sandbox';
import { resolveCredentialAccount } from 'src/assinafy-client/resolve-credential-account';
import { DOCUMENT_STATUS, FINAL_DOCUMENT_STATUSES } from 'src/constants/document-status';
import { cancelSignatureRequestHandler } from 'src/logic-functions/handlers/cancel-signature-request.handler';
import { resendSignatureRequestHandler } from 'src/logic-functions/handlers/resend-signature-request.handler';
import { deleteUnsentUpload } from 'src/services/delete-unsent-upload.service';
import { listTemplateSummaries } from 'src/services/list-template-summaries.service';
import { prepareSignatureRequest } from 'src/services/prepare-signature-request.service';
import { readPendingUploads } from 'src/services/read-pending-uploads.service';
import { rememberPendingUpload } from 'src/services/remember-pending-upload.service';
import { sendSignatureRequest } from 'src/services/send-signature-request.service';
import { syncAssinafyDocument } from 'src/services/sync-assinafy-document.service';
import { upsertSigners } from 'src/services/upsert-signers.service';
import { type AssinafyDocumentRecord } from 'src/types/assinafy-document-record';
import { type MemberHandlerContext } from 'src/types/member-handler-context';
import { type PreparedSignatureRequest } from 'src/types/prepared-signature-request';
import { type ResolvedCredential } from 'src/types/resolved-credential';
import { type SignatureRequestInput } from 'src/types/signature-request-input';
import { type SignerInput } from 'src/types/signer-input';
import { AppFailure } from 'src/utils/app-failure.util';
import { buildEstimateSigners } from 'src/utils/build-estimate-signers.util';
import { mapAssinafyStatus } from 'src/utils/map-assinafy-status.util';
import { normalizeCostEstimate } from 'src/utils/normalize-cost-estimate.util';
import { sanitizeProviderMessage } from 'src/utils/sanitize-provider-message.util';
import { signedFileLabel } from 'src/utils/signed-file-label.util';
import { summarizeTemplate } from 'src/utils/summarize-template.util';
import { toAppError } from 'src/utils/to-app-error.util';

const env = readSandboxEnv();
const RUN_ID = new Date().toISOString();
const INVALID_EMAIL = 'live-signer@example.invalid';
// Checksum-valid CPF reserved for tests; it belongs to nobody.
const TEST_CPF = '11144477735';

const ctx: MemberHandlerContext = {
  userCore: {} as CoreApiClient,
  appCore: {} as CoreApiClient,
  appMetadata: {} as MetadataApiClient,
  userWorkspaceId: randomUUID(),
  now: () => new Date(),
  createAssinafyClient: createSandboxClient,
};


// Provider messages are sanitized: they can echo contacts.
const describeError = (error: unknown) =>
  error instanceof ApiError
    ? { status: error.statusCode, message: sanitizeProviderMessage(error.message) }
    : { code: toAppError(error, 'read').code };

const count = (values: unknown[]) =>
  values.reduce<Record<string, number>>((counts, value) => {
    counts[String(value)] = (counts[String(value)] ?? 0) + 1;
    return counts;
  }, {});

const pendingUploadIds = async () => (await readPendingUploads()).map(({ documentId }) => documentId);

// Assertions compare these fields only, so a failing diff never prints a signer contact or the account id.
const progressOf = (record: AssinafyDocumentRecord | undefined) => ({
  status: record?.status,
  assinafyAssignmentId: record?.assinafyAssignmentId,
  signerCount: record?.signerCount,
  signedCount: record?.signedCount,
  lastError: record?.lastError,
});

const statusOrCode = (outcome: unknown) =>
  outcome instanceof AppFailure ? outcome.code : (outcome as { status?: unknown } | undefined)?.status;

// Cancels through the app handler; returns Assinafy's answer to DELETE and what the app made of it.
const cancelThroughApp = async (label: string, record: AssinafyDocumentRecord) => {
  const documentId = record.assinafyDocumentId ?? '';
  const outcome = await cancelSignatureRequestHandler({ documentRecordId: record.id }, ctx).catch((error: unknown) => error);
  const cancel = {
    deleteStatus: lastStatus('DELETE', `/documents/${documentId}`),
    handler: statusOrCode(outcome),
    record: records.get(record.id)?.status,
  };
  const afterDelete = await resolved.client.documents.details(documentId).then(
    (details) => ({ status: details.status, app: mapAssinafyStatus(details.status, { sent: true }) }),
    describeError,
  );
  const secondDelete =
    cancel.handler === DOCUMENT_STATUS.CANCELLED
      ? await resolved.client.documents.delete(documentId).then(() => 'accepted', describeError)
      : 'not attempted';
  report(label, { ...cancel, detailsAfterDelete: afterDelete, secondDelete });
  return cancel;
};

// Designed: 2xx → CANCELLED; 400 → PROVIDER_REJECTED, the record re-synced and still waiting for signatures.
const designedCancel = (deleteStatus: number | null | undefined) =>
  typeof deleteStatus === 'number' && deleteStatus < 300
    ? { deleteStatus, handler: DOCUMENT_STATUS.CANCELLED, record: DOCUMENT_STATUS.CANCELLED }
    : { deleteStatus: 400, handler: 'PROVIDER_REJECTED', record: DOCUMENT_STATUS.PENDING_SIGNATURE };

let resolved: ResolvedCredential;
let inbox: SignerInput;
let inboxId: string;
let invalidSigner: SignerInput | null = null;
let invalidId: string | null = null;
let request: SignatureRequestInput;
let prepared: PreparedSignatureRequest;
let sent: AssinafyDocumentRecord;

describe('Assinafy sandbox (live)', () => {
  beforeAll(async () => {
    resolved = await resolveCredentialAccount(env.credential, createSandboxClient);
  });

  afterAll(async () => {
    // One attempt each: an upload Assinafy was still processing earlier is deletable by now.
    for (const documentId of resolved ? await pendingUploadIds() : []) {
      await deleteUnsentUpload(resolved, documentId, ctx.appCore).catch((error: unknown) =>
        report('cleanup failed', { documentId, ...describeError(error) }),
      );
    }
    report('unsent uploads left in the sandbox', await pendingUploadIds());
    report(
      'sent documents left to expire',
      [...records.values()]
        .filter(({ status }) => status !== null && !FINAL_DOCUMENT_STATUSES.includes(status))
        .map(({ assinafyDocumentId, status, expiresAt }) => ({ assinafyDocumentId, status, expiresAt })),
    );
    report(
      'HTTP exchanges',
      httpExchanges.map(({ method, url, status }) => `${method} ${url} ${status}`),
    );
  });

  it('resolves the API key credential to the configured sandbox workspace', () => {
    expect(resolved.accountId === env.credential.configuredAccountId).toBe(true);
    expect(resolved.accountName).toEqual(expect.any(String));
    expect(resolved.client.getAxiosInstance().defaults.baseURL).toBe(SANDBOX_BASE_URL);
  });

  it('discards an unsent upload right after uploading it', async () => {
    const upload = await resolved.client.documents.upload(
      { buffer: buildPdf(`Discard ${RUN_ID}`), fileName: 'document.pdf' },
      { name: `Live discard ${RUN_ID}` },
    );
    await rememberPendingUpload({ documentId: upload.id, accountId: resolved.accountId, userWorkspaceId: null }, new Date());
    await deleteUnsentUpload(resolved, upload.id, ctx.appCore);

    const deleteStatus = lastStatus('DELETE', `/documents/${upload.id}`);
    const remembered = (await pendingUploadIds()).includes(upload.id);
    report('discard right after upload', { uploadStatus: upload.status, deleteStatus, remembered });

    // Designed: 400 (still processing) keeps the entry for the purge; a deleted upload is forgotten.
    expect([200, 204, 400]).toContain(deleteStatus);
    expect(remembered).toBe(deleteStatus === 400);
  });

  it('lists templates and summarizes the ready ones', async ({ skip }) => {
    const { data } = await resolved.client.templates.list({ page: 1, per_page: MAX_LIST_PAGE_SIZE });
    if (data.length === 0) return skip('The sandbox lists no template.');
    const summaries = await listTemplateSummaries(resolved.client);
    const firstField = data.flatMap((template) => template.pages ?? []).flatMap((page) => page.fields ?? [])[0];

    report('templates.list (first page)', {
      count: data.length,
      statuses: count(data.map(({ status }) => status)),
      assignmentTypes: count(data.flatMap(({ roles }) => (roles ?? []).map((role) => role.assignment_type))),
      fieldPlacementKeys: Object.keys(firstField ?? {}).toSorted(),
    });
    report(
      'template summaries',
      summaries.map(({ signerRoles, editorFields, unsupportedReason }) => ({
        signerRoles: signerRoles.length,
        editorFields: editorFields.length,
        unsupportedReason,
      })),
    );

    expect(summaries).toEqual(expect.arrayContaining(data.flatMap((template) => summarizeTemplate(template) ?? [])));
    // The payload keys summarizeTemplate reads: a renamed key would silently drop every template.
    for (const template of data) expect(template.status).toEqual(expect.any(String));
    const roles = data.flatMap((template) => template.roles ?? []);
    for (const role of roles) expect(role.assignment_type).toEqual(expect.any(String));
    expect(data.some((template) => template.status.toLowerCase() === 'ready')).toBe(true);
    expect(summaries.length).toBeGreaterThan(0);
    // A template without placed fields has nothing to check.
    expect(firstField === undefined || ('field_id' in firstField && 'role_id' in firstField)).toBe(true);
  });

  it('lists the document status catalog, every code known to the app', async () => {
    const statuses = await resolved.client.documents.statuses();
    report(
      'documents.statuses()',
      statuses.map(({ code, deletable }) => `${code}:${deletable ? 'deletable' : 'not deletable'}`),
    );

    expect(statuses.length).toBeGreaterThan(0);
    expect(
      statuses
        .map(({ code }) => code)
        .filter((code) => mapAssinafyStatus(code, { sent: true }) === DOCUMENT_STATUS.UNKNOWN),
    ).toEqual([]);
  });

  it('upserts the env inbox signer: reused by email, never renamed', async () => {
    const existing = await resolved.client.signers.findByEmail(env.signerEmail).catch((error: unknown) => {
      throw toAppError(error, 'read');
    });
    // Reusing the stored name keeps upsertSigners from renaming a signer the developer owns.
    inbox = buildSignerInput({ name: existing?.full_name ?? 'Assinafy Live Test', email: env.signerEmail });

    const [first] = await upsertSigners(resolved.client, [inbox]);
    const [second] = await upsertSigners(resolved.client, [inbox]);
    inboxId = first?.assinafySignerId ?? '';
    const updates = httpExchanges.filter(({ method, url }) => method === 'PUT' && url.endsWith(`/signers/${inboxId}`));
    report('env inbox signer', { existedBefore: existing !== null, updateCalls: updates.length });

    expect(second?.assinafySignerId).toBe(inboxId);
    expect(existing === null || existing.id === inboxId).toBe(true);
    expect(updates).toEqual([]);
  });

  it('upserts an @example.invalid signer and updates its name', async ({ skip }) => {
    const created = await upsertSigners(resolved.client, [buildSignerInput({ name: 'Live Test Signer A', email: INVALID_EMAIL })]).catch(
      (error: unknown) => toAppError(error, 'mutation'),
    );
    if (created instanceof AppFailure) {
      report('@example.invalid signer rejected; only the env inbox signs', { code: created.code, message: created.message });
      return skip('The sandbox rejects @example.invalid signers.');
    }

    const renamed = buildSignerInput({ name: 'Live Test Signer B', email: INVALID_EMAIL });
    const [again] = await upsertSigners(resolved.client, [renamed]);
    const id = created[0]?.assinafySignerId ?? '';
    const stored = await resolved.client.signers.get(id);
    report('@example.invalid signer', { accepted: true, renameStatus: lastStatus('PUT', `/accounts/${resolved.accountId}/signers/${id}`) });

    expect(again?.assinafySignerId).toBe(id);
    expect(stored.full_name).toBe(renamed.name);
    invalidSigner = renamed;
    invalidId = id;
  });

  it('updates a government id without any certificate request', async ({ skip }) => {
    if (!invalidSigner || !invalidId) return skip('Needs the @example.invalid signer.');

    // DigitalCertificate only makes upsertSigners send government_id; no assignment is ever created with it.
    const outcome = await upsertSigners(resolved.client, [
      { ...invalidSigner, verificationMethod: 'DigitalCertificate', governmentId: TEST_CPF },
    ]).catch((error: unknown) => toAppError(error, 'mutation'));
    if (outcome instanceof AppFailure) {
      report('government_id update rejected', { code: outcome.code, message: outcome.message });
      return skip('The sandbox rejects the government id update.');
    }

    const stored = await resolved.client.signers.get(invalidId);
    report('government_id update', {
      status: lastStatus('PUT', `/accounts/${resolved.accountId}/signers/${invalidId}`),
      echoed: Object.entries(stored)
        .filter(([key]) => /cpf|government/i.test(key))
        .map(([key, value]) => `${key}=${value === null ? 'null' : typeof value}`),
    });

    expect(outcome[0]?.assinafySignerId).toBe(invalidId);
  });

  it('prepares a PDF: uploads the attachment and estimates it immediately', async () => {
    request = {
      recordId: CRM_RECORD.id,
      source: { type: 'PDF', attachmentId: ATTACHMENT.id },
      name: `Live test ${RUN_ID}`,
      signers: [inbox, ...(invalidSigner ? [invalidSigner] : [])],
      message: 'Automated test of the Assinafy for Twenty sandbox suite. No action needed.',
      expiresAt: shortDeadline(new Date()),
      sequential: false,
      assinafyDocumentId: null,
    };
    const pdf = buildPdf(`Assinafy for Twenty live test ${RUN_ID}`);
    const realFetch = globalThis.fetch;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) =>
      input === ATTACHMENT.url
        ? new Response(new Uint8Array(pdf), {
            headers: { 'content-type': 'application/pdf', 'content-length': String(pdf.length) },
          })
        : realFetch(input, init),
    );
    try {
      prepared = await prepareSignatureRequest(ctx, request, resolved);
    } finally {
      fetchSpy.mockRestore();
    }

    const documentId = prepared.assinafyDocumentId ?? '';
    const { status } = await resolved.client.documents.details(documentId);
    const raw = await resolved.client.assignments.estimateCost(documentId, {
      method: 'virtual',
      signers: buildEstimateSigners(request.signers),
    });
    report('PDF estimate on the fresh upload', { statusAfterEstimate: status, raw });

    expect(prepared.accountId === env.credential.configuredAccountId).toBe(true);
    expect(await pendingUploadIds()).toContain(documentId);
    expect(raw.total_credits).toBe(raw.credits + (raw.needs_extra_document ? raw.extra_document_cost : 0));
    expect(normalizeCostEstimate(raw)).toEqual(prepared.estimate);
  });

  it('sends the PDF as a virtual assignment on the still-processing upload', async () => {
    const documentId = prepared.assinafyDocumentId ?? '';
    // Taken again here: the sandbox calls since the prepare must not eat into the send's deadline margin. The estimate
    // does not depend on it.
    request = { ...request, expiresAt: shortDeadline(new Date()) };
    const { status: statusBeforeSend } = await resolved.client.documents.details(documentId);

    const summary = await sendSignatureRequest(
      ctx,
      {
        ...request,
        assinafyDocumentId: documentId,
        requestId: randomUUID(),
        accountId: prepared.accountId,
        expectedTotalCredits: prepared.estimate.totalCredits,
        expectedDocuments: prepared.estimate.documents,
      },
      resolved,
    );
    const record = records.get(summary.documentRecordId);
    report('PDF send', {
      statusBeforeSend,
      assignmentStatus: lastStatus('POST', `/documents/${documentId}/assignments`),
      summaryStatus: summary.status,
      signers: record?.signers?.map(({ verificationMethod, notificationMethod, step, notified, completed, deliveryFailed }) => ({
        verificationMethod,
        notificationMethod,
        step,
        notified,
        completed,
        deliveryFailed,
      })),
    });

    expect(summary.status).toBe(DOCUMENT_STATUS.PENDING_SIGNATURE);
    expect(record?.assinafyAssignmentId).toEqual(expect.any(String));
    expect(record?.assinafyDocumentId).toBe(documentId);
    expect(record?.signers?.map(({ id }) => id).toSorted()).toEqual([inboxId, ...(invalidId ? [invalidId] : [])].toSorted());
    expect(await pendingUploadIds()).not.toContain(documentId);
    sent = record!;
  });

  it('returns the assignment and its summary on document details (expand=assignment)', async () => {
    const documentId = sent.assinafyDocumentId ?? '';
    const details = await resolved.client.documents.details(documentId);
    // An absolute URL bypasses the app's expand interceptor (it matches relative document paths only).
    const { data: bare } = await resolved.client
      .getAxiosInstance()
      .get<{ data?: Record<string, unknown> }>(`${SANDBOX_BASE_URL}/documents/${documentId}`);
    const bareAssignment = bare.data && 'assignment' in bare.data ? bare.data.assignment : 'absent';

    report('document details', {
      status: details.status,
      withExpand: {
        assignment: details.assignment !== null,
        assignmentKeys: Object.keys(details.assignment ?? {}).toSorted(),
        summaryKeys: Object.keys(details.assignment?.summary ?? {}).toSorted(),
        signerKeys: Object.keys(details.assignment?.signers?.[0] ?? {}).toSorted(),
        expiresAt: details.assignment?.expires_at,
        requestedExpiresAt: request.expiresAt,
      },
      withoutExpand: { assignment: bareAssignment === null || bareAssignment === 'absent' ? bareAssignment : 'present' },
    });

    expect(details.assignment?.id).toBe(sent.assinafyAssignmentId);
    expect({
      signerCount: details.assignment?.summary?.signer_count,
      completedCount: details.assignment?.summary?.completed_count,
    }).toEqual({ signerCount: request.signers.length, completedCount: 0 });
  });

  it('syncs the sent record from Assinafy', async () => {
    const synced = await syncAssinafyDocument(ctx, sent, resolved);
    report('sync after send', {
      ...progressOf(synced),
      storedExpiresAt: synced.expiresAt,
      signers: synced.signers?.map(({ notified, completed, deliveryFailed }) => ({ notified, completed, deliveryFailed })),
    });

    expect(progressOf(synced)).toEqual({
      status: DOCUMENT_STATUS.PENDING_SIGNATURE,
      assinafyAssignmentId: sent.assinafyAssignmentId,
      signerCount: request.signers.length,
      signedCount: 0,
      lastError: null,
    });
    expect(synced.lastSyncedAt).toEqual(expect.any(String));
    sent = synced;
  });

  it('quotes a resend (estimateResendCost, normalized)', async () => {
    const ids = [sent.assinafyDocumentId ?? '', sent.assinafyAssignmentId ?? '', inboxId] as const;
    const raw: unknown = await resolved.client.assignments.estimateResendCost(...ids).catch((error: unknown) => {
      report('estimateResendCost rejected', describeError(error));
      throw toAppError(error, 'read');
    });
    const shape =
      typeof raw === 'object' && raw !== null && 'has_sufficient_resources' in raw ? 'current (ICostEstimate)' : 'legacy';
    report('estimateResendCost', { shape, raw });

    const estimate = normalizeCostEstimate(raw);
    const notified = sent.signers?.find(({ id }) => id === inboxId)?.notified === true;
    const quote = await resendSignatureRequestHandler(
      { documentRecordId: sent.id, signerId: inboxId, expectedTotalCredits: null },
      ctx,
    ).catch((error: unknown) => error);
    report('resend quote through the app', { signerNotified: notified, outcome: statusOrCode(quote) ?? 'estimate' });

    // Designed: a notified signer gets the normalized quote; one not yet notified is refused before any call.
    expect(typeof estimate.sufficient).toBe('boolean');
    expect(notified ? quote : statusOrCode(quote)).toEqual(notified ? { estimate } : 'INVALID_STATE');
  });

  it('cancels the sent PDF through the app (documents.delete)', async () => {
    const cancel = await cancelThroughApp('cancel of the sent PDF', sent);
    expect(cancel).toEqual(designedCancel(cancel.deleteStatus));
  });

  it.skipIf(env.templateId === null)('estimates and sends a template, then tries to delete it', async () => {
    const templateId = env.templateId ?? '';
    const template = (await listTemplateSummaries(resolved.client)).find(({ id }) => id === templateId);
    if (!template || template.unsupportedReason !== null) {
      throw new Error('ASSINAFY_LIVE_TEMPLATE_ID must name a ready template with signer (and editor) roles only.');
    }
    if (template.signerRoles.length > 1 && !invalidSigner) {
      throw new Error('A template with several signer roles needs the sandbox to accept @example.invalid signers.');
    }

    const templateRequest: SignatureRequestInput = {
      recordId: CRM_RECORD.id,
      source: {
        type: 'TEMPLATE',
        templateId,
        editorFields: template.editorFields.map(({ fieldId }) => ({ fieldId, value: 'Live test' })),
      },
      name: `Live template ${RUN_ID}`,
      signers: template.signerRoles.map((role, index) =>
        index === 0
          ? { ...inbox, roleId: role.id }
          : buildSignerInput({ name: `Live Test Role ${index + 1}`, email: `live-role-${index + 1}@example.invalid`, roleId: role.id }),
      ),
      message: null,
      expiresAt: shortDeadline(new Date()),
      sequential: false,
      assinafyDocumentId: null,
    };
    const quote = await prepareSignatureRequest(ctx, templateRequest, resolved);
    const summary = await sendSignatureRequest(
      ctx,
      {
        ...templateRequest,
        expiresAt: shortDeadline(new Date()),
        requestId: randomUUID(),
        accountId: quote.accountId,
        expectedTotalCredits: quote.estimate.totalCredits,
        expectedDocuments: quote.estimate.documents,
      },
      resolved,
    );
    const record = records.get(summary.documentRecordId);
    report('template send', {
      estimate: quote.estimate,
      createStatus: lastStatus('POST', `/accounts/${resolved.accountId}/templates/${templateId}/documents`),
      ...progressOf(record),
    });

    expect(summary.status).toBe(DOCUMENT_STATUS.PENDING_SIGNATURE);
    expect(record?.assinafyAssignmentId).toEqual(expect.any(String));
    expect(record?.templateName).toBe(template.name);
    const cancel = await cancelThroughApp('cancel of the template document', record!);
    expect(cancel).toEqual(designedCancel(cancel.deleteStatus));
  });

  it.skipIf(env.signedDocumentId === null)('stores the signed files of a certificated document', async () => {
    const documentId = env.signedDocumentId ?? '';
    const record = await createAssinafyDocument(ctx.appCore, {
      name: `Live signed ${RUN_ID}`,
      status: DOCUMENT_STATUS.PENDING_SIGNATURE,
      requestId: randomUUID(),
      assinafyDocumentId: documentId,
      assinafyAccountId: resolved.accountId,
      sentAt: new Date().toISOString(),
    });

    const synced = await syncAssinafyDocument(ctx, record, resolved);
    const details = await resolved.client.documents.details(documentId);
    const artifacts = details.artifacts?.pades ? (['certificated', 'pades'] as const) : (['certificated'] as const);
    report('signed files', {
      status: details.status,
      artifacts: Object.keys(details.artifacts ?? {}).toSorted(),
      stored: synced.signedDocument?.map(({ label }) => label),
      bytes: signedFiles.map(({ buffer }) => buffer.length),
    });

    expect(synced.status).toBe(DOCUMENT_STATUS.CERTIFICATED);
    expect(synced.signedDocument?.map(({ label }) => label)).toEqual(
      artifacts.map((artifact) => signedFileLabel(record.name, artifact)),
    );
    expect(signedFiles.every(({ buffer }) => buffer.subarray(0, 5).toString('latin1') === '%PDF-')).toBe(true);
  });
});
