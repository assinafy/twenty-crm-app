import { ApiError, NetworkError, ValidationError } from '@assinafy/sdk';
import { describe, expect, it, vi } from 'vitest';

vi.mock('src/data/find-crm-record', () => ({ findCrmRecord: vi.fn<typeof findCrmRecord>() }));
vi.mock('src/data/find-assinafy-document-by-request-id', () => ({
  findAssinafyDocumentByRequestId: vi.fn<typeof findAssinafyDocumentByRequestId>(),
}));
vi.mock('src/data/create-assinafy-document', () => ({ createAssinafyDocument: vi.fn<typeof createAssinafyDocument>() }));
vi.mock('src/data/find-assinafy-documents', () => ({ findAssinafyDocuments: vi.fn<typeof findAssinafyDocuments>() }));
vi.mock('src/data/update-assinafy-document', () => ({ updateAssinafyDocument: vi.fn<typeof updateAssinafyDocument>() }));
vi.mock('src/assinafy-client/select-send-credential', () => ({
  selectSendCredential: vi.fn<typeof selectSendCredential>(),
}));
vi.mock('src/services/forget-pending-upload.service', () => ({ forgetPendingUpload: vi.fn<typeof forgetPendingUpload>() }));
vi.mock('src/services/read-pending-uploads.service', () => ({
  readPendingUploads: vi.fn<typeof readPendingUploads>(),
}));

import { buildContext, NOW } from 'src/__tests__/fixtures/build-context';
import { buildSignerInput } from 'src/__tests__/fixtures/build-signer-input';
import { LEAK_SENTINELS } from 'src/__tests__/setup/unit-test-setup';
import { selectSendCredential } from 'src/assinafy-client/select-send-credential';
import { BILLABLE_CALL_BUDGET_MS, PENDING_UPLOAD_SEND_CUTOFF_MS } from 'src/constants/limits';
import { permissionDenied } from 'src/data/__tests__/permission-denied';
import { createAssinafyDocument } from 'src/data/create-assinafy-document';
import { findAssinafyDocumentByRequestId } from 'src/data/find-assinafy-document-by-request-id';
import { findAssinafyDocuments } from 'src/data/find-assinafy-documents';
import { findCrmRecord } from 'src/data/find-crm-record';
import { updateAssinafyDocument } from 'src/data/update-assinafy-document';
import {
  assignment,
  costEstimate,
  crmRecord,
  documentDetails,
  documentRecord,
  fakeAssinafyClient,
  pdfInput,
  pendingUpload,
  RECORD_ID,
  REQUEST_ID,
  resolvedCredential,
  sendInput,
  templateInput,
  templateItem,
} from 'src/services/__tests__/service-fixtures';
import { forgetPendingUpload } from 'src/services/forget-pending-upload.service';
import { readPendingUploads } from 'src/services/read-pending-uploads.service';
import { sendSignatureRequest } from 'src/services/send-signature-request.service';
import { type AssinafyDocumentPatch } from 'src/types/assinafy-document-patch';
import { type SendSignatureRequestInput } from 'src/types/send-signature-request-input';
import { AppFailure } from 'src/utils/app-failure.util';

const create = vi.mocked(createAssinafyDocument);
const update = vi.mocked(updateAssinafyDocument);
const findByRequestId = vi.mocked(findAssinafyDocumentByRequestId);
const findDocuments = vi.mocked(findAssinafyDocuments);
const SIGNING_URL = LEAK_SENTINELS[3];
const minutesFromNow = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000).toISOString();
const PERMISSION_DENIED = permissionDenied();
const NOT_FAILED = { or: [{ status: { neq: 'FAILED' } }, { status: { is: 'NULL' } }] };

const setup = () => {
  const fake = fakeAssinafyClient();
  const resolved = resolvedCredential(fake.client);
  const ctx = buildContext();
  vi.mocked(findCrmRecord).mockResolvedValue(crmRecord());
  findByRequestId.mockResolvedValue(null);
  findDocuments.mockResolvedValue([]);
  vi.mocked(selectSendCredential).mockResolvedValue(resolved);
  create.mockImplementation(async (_core, data) => documentRecord({ ...data, id: 'record-doc-1' }));
  update.mockImplementation(async (_core, id, patch) => documentRecord({ id, ...patch }));
  fake.documents.details.mockResolvedValue(documentDetails());
  fake.assignments.estimateCost.mockResolvedValue(costEstimate());
  vi.mocked(readPendingUploads).mockResolvedValue([pendingUpload()]);
  fake.signers.create.mockResolvedValue({ id: 'signer-1', full_name: 'Ana Souza', email: 'ana@example.invalid' });
  fake.assignments.create.mockResolvedValue(assignment());
  fake.templates.list.mockResolvedValue({ data: [templateItem()] });
  fake.documents.estimateCostFromTemplate.mockResolvedValue(costEstimate());
  fake.documents.createFromTemplate.mockResolvedValue(
    documentDetails({ id: 'doc-template', status: 'pending_signature', assignment: assignment() }),
  );
  return { fake, resolved, ctx };
};

const pdfSend = (overrides: Partial<SendSignatureRequestInput> = {}) =>
  sendInput(pdfInput({ assinafyDocumentId: 'doc-1' }), overrides);
const templateSend = (overrides: Partial<SendSignatureRequestInput> = {}) => sendInput(templateInput(), overrides);
const lastPatch = (): AssinafyDocumentPatch | undefined => update.mock.lastCall?.[2];

describe('sendSignatureRequest — idempotency', () => {
  it('returns the document of a request id already used and never sends again', async () => {
    const { fake, ctx } = setup();
    findByRequestId.mockResolvedValue(documentRecord({ status: 'PENDING_SIGNATURE' }));

    await expect(sendSignatureRequest(ctx, pdfSend())).resolves.toMatchObject({
      documentRecordId: 'record-doc-1',
      status: 'PENDING_SIGNATURE',
    });
    expect(findByRequestId).toHaveBeenCalledWith(ctx.userCore, REQUEST_ID);
    expect(selectSendCredential).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(fake.assignments.create).not.toHaveBeenCalled();
  });

  it('returns the document a concurrent send created with the same request id', async () => {
    const { fake, ctx } = setup();
    create.mockRejectedValue(new Error('A duplicate entry was detected: unique constraint violated'));
    findByRequestId.mockResolvedValueOnce(null).mockResolvedValueOnce(documentRecord({ status: 'SENDING' }));

    await expect(sendSignatureRequest(ctx, pdfSend())).resolves.toMatchObject({ status: 'SENDING' });
    expect(findByRequestId).toHaveBeenCalledTimes(2);
    expect(forgetPendingUpload).not.toHaveBeenCalled();
    expect(fake.signers.create).not.toHaveBeenCalled();
    expect(fake.assignments.create).not.toHaveBeenCalled();
  });

  it.each([
    ['any other create failure', new Error('GraphQL error: permission denied'), null],
    ['a duplicate it cannot read back', new Error('duplicate key value violates unique constraint'), null],
  ])('rethrows %s without sending', async (_label, error, reread) => {
    const { fake, ctx } = setup();
    create.mockRejectedValue(error);
    findByRequestId.mockResolvedValue(reread);

    await expect(sendSignatureRequest(ctx, pdfSend())).rejects.toBe(error);
    expect(fake.assignments.create).not.toHaveBeenCalled();
  });

  it('answers FORBIDDEN, not INTERNAL, when the member role cannot create the record', async () => {
    const { fake, ctx } = setup();
    create.mockRejectedValue(PERMISSION_DENIED);

    await expect(sendSignatureRequest(ctx, pdfSend())).rejects.toMatchObject({
      code: 'FORBIDDEN',
      details: { reason: 'member_create_permission' },
    });
    expect(findByRequestId).toHaveBeenCalledTimes(1);
    expect(fake.signers.create).not.toHaveBeenCalled();
    expect(fake.assignments.create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('answers FORBIDDEN when the member role cannot read the records', async () => {
    const { fake, ctx } = setup();
    findByRequestId.mockRejectedValue(PERMISSION_DENIED);

    await expect(sendSignatureRequest(ctx, pdfSend())).rejects.toMatchObject({
      code: 'FORBIDDEN',
      details: { reason: 'member_create_permission' },
    });
    expect(selectSendCredential).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(fake.assignments.create).not.toHaveBeenCalled();
  });

  it('rethrows any other failure of the request id lookup', async () => {
    const { ctx } = setup();
    const error = new Error('GraphQL error');
    findByRequestId.mockRejectedValue(error);

    await expect(sendSignatureRequest(ctx, pdfSend())).rejects.toBe(error);
    expect(create).not.toHaveBeenCalled();
  });

  it('returns the document of a known request id even when its deadline has passed since', async () => {
    const { fake, ctx } = setup();
    findByRequestId.mockResolvedValue(documentRecord({ status: 'PENDING_SIGNATURE' }));

    await expect(sendSignatureRequest(ctx, templateSend({ expiresAt: minutesFromNow(-30) }))).resolves.toMatchObject({
      documentRecordId: 'record-doc-1',
    });
    expect(fake.documents.createFromTemplate).not.toHaveBeenCalled();
  });
});

describe('sendSignatureRequest — checks before the record exists', () => {
  it('fails with NOT_FOUND when the person cannot read the record', async () => {
    const { ctx } = setup();
    vi.mocked(findCrmRecord).mockResolvedValue(null);

    await expect(sendSignatureRequest(ctx, pdfSend())).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(findCrmRecord).toHaveBeenCalledWith(ctx.userCore, RECORD_ID);
    expect(create).not.toHaveBeenCalled();
  });

  it('fails with INVALID_STATE when the credential now reaches another Assinafy workspace', async () => {
    const { fake, ctx } = setup();

    await expect(sendSignatureRequest(ctx, pdfSend({ accountId: 'account-2' }))).rejects.toMatchObject({
      code: 'INVALID_STATE',
    });
    expect(create).not.toHaveBeenCalled();
    expect(fake.assignments.create).not.toHaveBeenCalled();
  });

  it('requires the uploaded PDF', async () => {
    const { ctx } = setup();

    await expect(sendSignatureRequest(ctx, sendInput(pdfInput()))).rejects.toMatchObject({
      code: 'INVALID_INPUT',
      details: { field: 'assinafyDocumentId', reason: 'required' },
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('validates the live template', async () => {
    const { fake, ctx } = setup();
    fake.templates.list.mockResolvedValue({ data: [templateItem({ status: 'Processing' })] });

    await expect(sendSignatureRequest(ctx, templateSend())).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect(create).not.toHaveBeenCalled();
  });

  it('uses the credential a background caller passes instead of the member one', async () => {
    const { resolved, ctx } = setup();

    await sendSignatureRequest({ ...ctx, userWorkspaceId: null }, pdfSend(), resolved);

    expect(selectSendCredential).not.toHaveBeenCalled();
  });
});

describe('sendSignatureRequest — SENDING record', () => {
  it('claims the request id with the person client before any billable call', async () => {
    const { fake, ctx } = setup();

    await sendSignatureRequest(ctx, pdfSend({ expiresAt: minutesFromNow(120) }));

    expect(create).toHaveBeenCalledExactlyOnceWith(ctx.userCore, {
      name: 'Service agreement',
      status: 'SENDING',
      requestId: REQUEST_ID,
      assinafyAccountId: 'account-1',
      assinafyDocumentId: 'doc-1',
      templateName: null,
      expiresAt: minutesFromNow(120),
      signerCount: 1,
      signedCount: 0,
      personId: RECORD_ID,
      companyId: null,
      opportunityId: null,
    });
    expect(create.mock.invocationCallOrder[0]).toBeLessThan(
      fake.assignments.create.mock.invocationCallOrder[0] ?? -Infinity,
    );
  });

  it('releases the pending upload only once the request is sent', async () => {
    const { fake, ctx } = setup();

    await sendSignatureRequest(ctx, pdfSend());

    expect(forgetPendingUpload).toHaveBeenCalledExactlyOnceWith('doc-1');
    expect(vi.mocked(forgetPendingUpload).mock.invocationCallOrder[0]).toBeGreaterThan(
      fake.assignments.create.mock.invocationCallOrder[0] ?? Infinity,
    );
  });

  it.each([
    ['company', { personId: null, companyId: RECORD_ID, opportunityId: null }],
    ['opportunity', { personId: null, companyId: null, opportunityId: RECORD_ID }],
  ] as const)('links a %s record', async (objectNameSingular, relations) => {
    const { ctx } = setup();
    vi.mocked(findCrmRecord).mockResolvedValue(crmRecord({ objectNameSingular }));

    await sendSignatureRequest(ctx, pdfSend());

    expect(create).toHaveBeenCalledWith(ctx.userCore, expect.objectContaining(relations));
  });
});

describe('sendSignatureRequest — estimate comparison', () => {
  it.each([
    ['more credits', costEstimate({ total_credits: 0.45 }), {}],
    ['fewer credits', costEstimate({ total_credits: 1 }), { expectedTotalCredits: 1.01 }],
    ['another document count', costEstimate({ documents: 0 }), {}],
  ])('fails with COST_CHANGED on %s and never sends', async (_label, fresh, expected) => {
    const { fake, ctx } = setup();
    fake.assignments.estimateCost.mockResolvedValue(fresh);

    const failure = await sendSignatureRequest(ctx, pdfSend(expected)).catch((error: unknown) => error);

    expect(failure).toMatchObject({ code: 'COST_CHANGED', details: { estimate: expect.any(Object) } });
    expect(create).not.toHaveBeenCalled();
    expect(fake.signers.create).not.toHaveBeenCalled();
    expect(fake.assignments.create).not.toHaveBeenCalled();
  });

  it('compares in cents, so float noise is not a change', async () => {
    const { fake, ctx } = setup();
    fake.assignments.estimateCost.mockResolvedValue(costEstimate({ total_credits: 0.45 * 3 }));

    await sendSignatureRequest(ctx, pdfSend({ expectedTotalCredits: 1.35 }));

    expect(fake.assignments.create).toHaveBeenCalledTimes(1);
  });

  it('fails with INSUFFICIENT_RESOURCES and never sends', async () => {
    const { fake, ctx } = setup();
    fake.assignments.estimateCost.mockResolvedValue(
      costEstimate({ has_sufficient_resources: false, blocking_reason: 'InsufficientCredits' }),
    );

    await expect(sendSignatureRequest(ctx, pdfSend())).rejects.toMatchObject({
      code: 'INSUFFICIENT_RESOURCES',
      details: { blockingReason: 'InsufficientCredits' },
    });
    expect(create).not.toHaveBeenCalled();
    expect(fake.assignments.create).not.toHaveBeenCalled();
  });

  it('re-checks the deadline with the send margin and creates no record when it is too close', async () => {
    const { fake, ctx } = setup();

    await expect(sendSignatureRequest(ctx, pdfSend({ expiresAt: minutesFromNow(64) }))).rejects.toMatchObject({
      code: 'INVALID_INPUT',
      details: { field: 'expiresAt', reason: 'too_soon' },
    });
    expect(create).not.toHaveBeenCalled();
    expect(fake.assignments.estimateCost).not.toHaveBeenCalled();
  });
});

describe('sendSignatureRequest — PDF billable call', () => {
  it('requests the signatures once and records PENDING_SIGNATURE, sentAt and the assignment', async () => {
    const { fake, ctx } = setup();

    const summary = await sendSignatureRequest(
      ctx,
      pdfSend({ message: 'Please sign', expiresAt: minutesFromNow(65) }),
    );

    expect(fake.assignments.create).toHaveBeenCalledExactlyOnceWith('doc-1', {
      method: 'virtual',
      signers: [{ id: 'signer-1', verification_method: 'Email', notification_methods: ['Email'] }],
      message: 'Please sign',
      expires_at: minutesFromNow(65),
    });
    expect(update).toHaveBeenCalledExactlyOnceWith(ctx.appCore, 'record-doc-1', {
      status: 'PENDING_SIGNATURE',
      sentAt: NOW.toISOString(),
      assinafyDocumentId: 'doc-1',
      assinafyAssignmentId: 'assignment-1',
      signers: [expect.objectContaining({ id: 'signer-1', notified: true, declined: false })],
      lastError: null,
    });
    expect(JSON.stringify(lastPatch())).not.toContain(SIGNING_URL);
    expect(summary).toMatchObject({ documentRecordId: 'record-doc-1', status: 'PENDING_SIGNATURE', lastError: null });
  });

  it('omits an empty message and deadline, and orders sequential signers', async () => {
    const { fake, ctx } = setup();
    fake.signers.create
      .mockResolvedValueOnce({ id: 'signer-1', full_name: 'Ana Souza', email: 'ana@example.invalid' })
      .mockResolvedValueOnce({ id: 'signer-2', full_name: 'Bruno Lima', email: 'bruno@example.invalid' });

    await sendSignatureRequest(
      ctx,
      sendInput(
        pdfInput({
          assinafyDocumentId: 'doc-1',
          sequential: true,
          signers: [buildSignerInput(), buildSignerInput({ name: 'Bruno Lima', email: 'bruno@example.invalid' })],
        }),
      ),
    );

    expect(fake.assignments.create).toHaveBeenCalledWith('doc-1', {
      method: 'virtual',
      signers: [
        { id: 'signer-1', verification_method: 'Email', notification_methods: ['Email'], step: 1 },
        { id: 'signer-2', verification_method: 'Email', notification_methods: ['Email'], step: 2 },
      ],
    });
  });

  it.each([
    ['a network error', () => new NetworkError('socket hang up')],
    ['a timeout', () => new NetworkError('Failed to create assignment: timeout of 30000ms exceeded')],
    ['a reset', () => new NetworkError('Failed to create assignment: read ECONNRESET')],
    ['HTTP 500', () => new ApiError('Server error', 500)],
    ['HTTP 502', () => new ApiError('Bad gateway', 502)],
    ['HTTP 503', () => new ApiError('Unavailable', 503)],
    ['HTTP 504', () => new ApiError('Gateway timeout', 504)],
    ['HTTP 408', () => new ApiError('Request timeout', 408)],
    ['HTTP 409', () => new ApiError('Conflict', 409)],
    ['an unexpected error', () => new TypeError('Cannot read properties of undefined')],
  ])('marks the record UNCERTAIN on %s, without retrying', async (_label, error) => {
    const { fake, ctx } = setup();
    fake.assignments.create.mockRejectedValue(error());

    await expect(sendSignatureRequest(ctx, pdfSend())).rejects.toMatchObject({
      code: 'UNCERTAIN',
      details: { documentRecordId: 'record-doc-1' },
    });
    expect(fake.assignments.create).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledExactlyOnceWith(ctx.appCore, 'record-doc-1', {
      status: 'UNCERTAIN',
      lastError: 'UNCERTAIN',
    });
    expect(forgetPendingUpload).not.toHaveBeenCalled();
  });

  it.each([
    [() => new ApiError('WhatsApp indisponível no plano', 400), 'PROVIDER_REJECTED'],
    [() => new ApiError('Unauthorized', 401), 'RECONNECT_REQUIRED'],
    [() => new ApiError('Forbidden', 403), 'FORBIDDEN'],
    [() => new ApiError('Not found', 404), 'NOT_FOUND'],
    [() => new ApiError('Unprocessable', 422), 'PROVIDER_REJECTED'],
    [() => new ApiError('Too many requests', 429), 'RATE_LIMITED'],
    [() => new ValidationError('signers must not be empty'), 'INVALID_INPUT'],
  ])('marks the record FAILED with the code of a definitive rejection (%#)', async (error, code) => {
    const { fake, ctx } = setup();
    fake.assignments.create.mockRejectedValue(error());

    await expect(sendSignatureRequest(ctx, pdfSend())).rejects.toMatchObject({
      code,
      details: { documentRecordId: 'record-doc-1' },
    });
    expect(fake.assignments.create).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledExactlyOnceWith(ctx.appCore, 'record-doc-1', { status: 'FAILED', lastError: code });
    expect(forgetPendingUpload).not.toHaveBeenCalled();
  });

  it('fails the record when a signer cannot be saved, before any billable call', async () => {
    const { fake, ctx } = setup();
    fake.signers.create.mockRejectedValue(new ApiError('Invalid phone', 400));

    await expect(sendSignatureRequest(ctx, pdfSend())).rejects.toMatchObject({ code: 'PROVIDER_REJECTED' });
    expect(lastPatch()).toEqual({ status: 'FAILED', lastError: 'PROVIDER_REJECTED' });
    expect(fake.assignments.create).not.toHaveBeenCalled();
  });

  it('still reports the failure when recording it fails', async () => {
    const { fake, ctx } = setup();
    fake.assignments.create.mockRejectedValue(new NetworkError('socket hang up'));
    update.mockRejectedValue(new Error('Twenty unavailable'));

    await expect(sendSignatureRequest(ctx, pdfSend())).rejects.toMatchObject({ code: 'UNCERTAIN' });
    expect(console.error).toHaveBeenCalledWith('[assinafy] recording a failed signature request failed', {
      code: 'UNCERTAIN',
      name: 'Error',
    });
  });

  it('reports a sent request as sent even when Twenty cannot record it', async () => {
    const { fake, ctx } = setup();
    update.mockRejectedValue(new Error('Twenty unavailable'));

    await expect(sendSignatureRequest(ctx, pdfSend())).resolves.toMatchObject({
      status: 'PENDING_SIGNATURE',
      sentAt: NOW.toISOString(),
    });
    expect(fake.assignments.create).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalledWith('[assinafy] recording a sent signature request failed', {
      attempt: 2,
      name: 'Error',
    });
  });

  it('retries recording a sent request once', async () => {
    const { ctx } = setup();
    update.mockRejectedValueOnce(new Error('Twenty busy'));

    await expect(sendSignatureRequest(ctx, pdfSend())).resolves.toMatchObject({ status: 'PENDING_SIGNATURE' });
    expect(update).toHaveBeenCalledTimes(2);
  });
});

describe('sendSignatureRequest — state of the uploaded PDF', () => {
  it('returns the visible record of an upload that was already sent instead of sending it again', async () => {
    const { fake, ctx } = setup();
    fake.documents.details.mockResolvedValue(documentDetails({ status: 'pending_signature', assignment: assignment() }));
    findDocuments.mockResolvedValue([documentRecord({ id: 'record-earlier', status: 'UNCERTAIN' })]);

    await expect(sendSignatureRequest(ctx, pdfSend())).resolves.toMatchObject({
      documentRecordId: 'record-earlier',
      status: 'UNCERTAIN',
    });
    expect(findDocuments).toHaveBeenCalledExactlyOnceWith(ctx.userCore, {
      filter: { assinafyDocumentId: { eq: 'doc-1' }, ...NOT_FAILED },
      first: 1,
    });
    expect(fake.assignments.estimateCost).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(fake.assignments.create).not.toHaveBeenCalled();
  });

  it('returns an earlier send of an upload whose pending-upload entry is already forgotten', async () => {
    const { fake, ctx } = setup();
    vi.mocked(readPendingUploads).mockResolvedValue([]);
    fake.documents.details.mockResolvedValue(documentDetails({ status: 'pending_signature', assignment: assignment() }));
    findDocuments.mockResolvedValue([documentRecord({ id: 'record-earlier', status: 'PENDING_SIGNATURE' })]);

    await expect(sendSignatureRequest(ctx, pdfSend())).resolves.toMatchObject({ documentRecordId: 'record-earlier' });
  });

  it('never answers with a FAILED attempt for an upload that was assigned elsewhere', async () => {
    const { fake, ctx } = setup();
    fake.documents.details.mockResolvedValue(documentDetails({ status: 'pending_signature', assignment: assignment() }));
    findDocuments.mockImplementation(async (_core, options) =>
      options.filter && 'or' in options.filter ? [] : [documentRecord({ id: 'record-failed', status: 'FAILED' })],
    );

    await expect(sendSignatureRequest(ctx, pdfSend())).rejects.toMatchObject({ code: 'INVALID_STATE' });
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(fake.assignments.create).not.toHaveBeenCalled();
  });

  it.each([
    ['prepared by another member', [pendingUpload({ userWorkspaceId: 'member-2' })]],
    ['prepared by a workflow', [pendingUpload({ userWorkspaceId: null })]],
    ['with no pending-upload entry', []],
    [
      'the purge may delete before the send finishes',
      [pendingUpload({ createdAt: new Date(NOW.getTime() - PENDING_UPLOAD_SEND_CUTOFF_MS).toISOString() })],
    ],
  ])('refuses an upload %s before any record or billable call', async (_label, entries) => {
    const { fake, ctx } = setup();
    vi.mocked(readPendingUploads).mockResolvedValue(entries);

    await expect(sendSignatureRequest(ctx, pdfSend())).rejects.toMatchObject({ code: 'INVALID_STATE' });
    expect(fake.assignments.estimateCost).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(fake.signers.create).not.toHaveBeenCalled();
    expect(fake.assignments.create).not.toHaveBeenCalled();
  });

  it('sends the member upload until just before the send cutoff', async () => {
    const { fake, ctx } = setup();
    vi.mocked(readPendingUploads).mockResolvedValue([
      pendingUpload({ createdAt: new Date(NOW.getTime() - PENDING_UPLOAD_SEND_CUTOFF_MS + 1).toISOString() }),
    ]);

    await expect(sendSignatureRequest(ctx, pdfSend())).resolves.toMatchObject({ status: 'PENDING_SIGNATURE' });
    expect(fake.assignments.create).toHaveBeenCalledTimes(1);
  });

  it('lets a background caller send its own upload without a member entry', async () => {
    const { fake, resolved, ctx } = setup();
    vi.mocked(readPendingUploads).mockResolvedValue([]);

    await expect(sendSignatureRequest({ ...ctx, userWorkspaceId: null }, pdfSend(), resolved)).resolves.toMatchObject({
      status: 'PENDING_SIGNATURE',
    });
    expect(readPendingUploads).not.toHaveBeenCalled();
    expect(fake.assignments.create).toHaveBeenCalledTimes(1);
  });

  it('never attaches an upload someone else sent to a new record', async () => {
    const { fake, ctx } = setup();
    fake.documents.details.mockResolvedValue(documentDetails({ status: 'pending_signature', assignment: assignment() }));

    await expect(sendSignatureRequest(ctx, pdfSend())).rejects.toMatchObject({ code: 'INVALID_STATE' });
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(fake.assignments.create).not.toHaveBeenCalled();
  });

  it.each([
    ['past draft without an assignment', documentDetails({ status: 'expired' }), 'INVALID_STATE'],
    ['in another workspace', documentDetails({ account_id: 'account-2' }), 'INVALID_STATE'],
  ])('creates no record when the upload is %s', async (_label, details, code) => {
    const { fake, ctx } = setup();
    fake.documents.details.mockResolvedValue(details);

    await expect(sendSignatureRequest(ctx, pdfSend())).rejects.toMatchObject({ code });
    expect(create).not.toHaveBeenCalled();
    expect(fake.assignments.create).not.toHaveBeenCalled();
  });

  it('creates no record when Assinafy no longer has the upload', async () => {
    const { fake, ctx } = setup();
    fake.documents.details.mockRejectedValue(new ApiError('Not found', 404));

    await expect(sendSignatureRequest(ctx, pdfSend())).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(create).not.toHaveBeenCalled();
  });
});

describe('sendSignatureRequest — template billable call', () => {
  it('creates the document from the template once and records it', async () => {
    const { fake, ctx } = setup();

    await expect(
      sendSignatureRequest(ctx, templateSend({ message: 'Hi', expiresAt: minutesFromNow(90) })),
    ).resolves.toMatchObject({ status: 'PENDING_SIGNATURE' });

    expect(create).toHaveBeenCalledWith(
      ctx.userCore,
      expect.objectContaining({ templateName: 'Sales contract', assinafyDocumentId: null }),
    );
    expect(forgetPendingUpload).not.toHaveBeenCalled();
    expect(fake.templates.list).toHaveBeenCalledTimes(1);
    expect(fake.documents.createFromTemplate).toHaveBeenCalledExactlyOnceWith(
      'template-1',
      [{ role_id: 'role-client', id: 'signer-1', verification_method: 'Email', notification_methods: ['Email'] }],
      {
        name: 'Service agreement',
        message: 'Hi',
        expires_at: minutesFromNow(90),
        editor_fields: [{ field_id: 'field-price', value: '100' }],
      },
    );
    expect(lastPatch()).toMatchObject({
      status: 'PENDING_SIGNATURE',
      sentAt: NOW.toISOString(),
      assinafyDocumentId: 'doc-template',
      assinafyAssignmentId: 'assignment-1',
    });
  });

  it('sends no editor fields for a template without editor roles', async () => {
    const { fake, ctx } = setup();
    fake.templates.list.mockResolvedValue({
      data: [templateItem({ roles: [{ id: 'role-client', name: 'Client', assignment_type: 'Signer' }], pages: [] })],
    });

    await sendSignatureRequest(
      ctx,
      templateSend({ source: { type: 'TEMPLATE', templateId: 'template-1', editorFields: [] } }),
    );

    expect(fake.documents.createFromTemplate.mock.lastCall?.[2]).toEqual({ name: 'Service agreement' });
  });

  it('records a created document whose response has no assignment yet', async () => {
    const { fake, ctx } = setup();
    fake.documents.createFromTemplate.mockResolvedValue(documentDetails({ id: 'doc-template', assignment: null }));

    await sendSignatureRequest(ctx, templateSend());

    expect(lastPatch()).toMatchObject({ assinafyDocumentId: 'doc-template', assinafyAssignmentId: null, signers: [] });
  });

  it.each([
    ['nothing', undefined],
    ['an empty string', ''],
    ['an HTML page', '<html>ok</html>'],
    ['a body without an id', { status: 'pending_signature', assignment: null }],
    ['an empty id', documentDetails({ id: '' })],
    ['a numeric id', { id: 42 }],
    ['an id that is not an Assinafy id', { id: 'bad id/..' }],
  ])('marks the record UNCERTAIN when the template send answers %s', async (_label, body) => {
    const { fake, ctx } = setup();
    fake.documents.createFromTemplate.mockResolvedValue(body as never);

    await expect(sendSignatureRequest(ctx, templateSend())).rejects.toMatchObject({ code: 'UNCERTAIN' });
    expect(fake.documents.createFromTemplate).toHaveBeenCalledTimes(1);
    expect(lastPatch()).toEqual({ status: 'UNCERTAIN', lastError: 'UNCERTAIN' });
    expect(update.mock.calls.some(([, , patch]) => patch.status === 'PENDING_SIGNATURE')).toBe(false);
  });

  it('marks the record UNCERTAIN when the template send times out', async () => {
    const { fake, ctx } = setup();
    fake.documents.createFromTemplate.mockRejectedValue(new ApiError('Gateway timeout', 504));

    await expect(sendSignatureRequest(ctx, templateSend())).rejects.toBeInstanceOf(AppFailure);
    expect(fake.documents.createFromTemplate).toHaveBeenCalledTimes(1);
    expect(lastPatch()).toEqual({ status: 'UNCERTAIN', lastError: 'UNCERTAIN' });
  });

  it('compares the template estimate too', async () => {
    const { fake, ctx } = setup();
    fake.documents.estimateCostFromTemplate.mockResolvedValue(costEstimate({ total_credits: 2 }));

    await expect(sendSignatureRequest(ctx, templateSend())).rejects.toMatchObject({ code: 'COST_CHANGED' });
    expect(fake.documents.createFromTemplate).not.toHaveBeenCalled();
  });
});

describe('sendSignatureRequest — run deadline', () => {
  it.each([
    ['PDF', pdfSend],
    ['template', templateSend],
  ])('never starts the %s billable call without time for it to settle, and fails the record', async (_label, send) => {
    const { fake, ctx } = setup();

    await expect(
      sendSignatureRequest(ctx, send({ deadlineMs: NOW.getTime() + BILLABLE_CALL_BUDGET_MS - 1 })),
    ).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
    expect(create).toHaveBeenCalledTimes(1);
    expect(fake.assignments.create).not.toHaveBeenCalled();
    expect(fake.documents.createFromTemplate).not.toHaveBeenCalled();
    expect(lastPatch()).toEqual({ status: 'FAILED', lastError: 'PROVIDER_UNAVAILABLE' });
  });

  it('sends once when enough time is left', async () => {
    const { fake, ctx } = setup();

    await expect(
      sendSignatureRequest(ctx, pdfSend({ deadlineMs: NOW.getTime() + BILLABLE_CALL_BUDGET_MS })),
    ).resolves.toMatchObject({ status: 'PENDING_SIGNATURE' });
    expect(fake.assignments.create).toHaveBeenCalledTimes(1);
  });

  it('checks the deadline after saving the signers, right before the billable call', async () => {
    const { fake, ctx } = setup();
    let now = NOW.getTime();
    fake.signers.create.mockImplementation(async () => {
      now += 10_000;
      return { id: 'signer-1', full_name: 'Ana Souza', email: 'ana@example.invalid' };
    });

    await expect(
      sendSignatureRequest(
        { ...ctx, now: () => new Date(now) },
        pdfSend({ deadlineMs: NOW.getTime() + BILLABLE_CALL_BUDGET_MS + 5_000 }),
      ),
    ).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
    expect(fake.signers.create).toHaveBeenCalledTimes(1);
    expect(fake.assignments.create).not.toHaveBeenCalled();
  });
});
