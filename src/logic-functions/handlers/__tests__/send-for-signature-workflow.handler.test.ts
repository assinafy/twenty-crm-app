import { ApiError } from '@assinafy/sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildContext, NOW } from 'src/__tests__/fixtures/build-context';
import { buildCostEstimate } from 'src/__tests__/fixtures/build-cost-estimate';
import { listBackgroundCredentials } from 'src/assinafy-client/list-background-credentials';
import { resolveCredentialAccount } from 'src/assinafy-client/resolve-credential-account';
import { findAssinafyDocumentByRequestId } from 'src/data/find-assinafy-document-by-request-id';
import { findAssinafyDocuments } from 'src/data/find-assinafy-documents';
import { findAttachmentFile } from 'src/data/find-attachment-file';
import { findContacts } from 'src/data/find-contacts';
import { findCrmRecord } from 'src/data/find-crm-record';
import { sendForSignatureWorkflowHandler } from 'src/logic-functions/handlers/send-for-signature-workflow.handler';
import {
  apiKeyCredential,
  buildResolved,
  sharedCredential,
} from 'src/logic-functions/handlers/__tests__/document-handler-fixtures';
import { deleteUnsentUpload } from 'src/services/delete-unsent-upload.service';
import { listTemplateSummaries } from 'src/services/list-template-summaries.service';
import { prepareSignatureRequest } from 'src/services/prepare-signature-request.service';
import { sendSignatureRequest } from 'src/services/send-signature-request.service';
import { type AssinafyDocumentRecord } from 'src/types/assinafy-document-record';
import { type CostEstimate } from 'src/types/cost-estimate';
import { type CrmRecord } from 'src/types/crm-record';
import { type DocumentSummary } from 'src/types/document-summary';
import { type HandlerContext } from 'src/types/handler-context';
import { type TemplateSummary } from 'src/types/template-summary';
import { AppFailure } from 'src/utils/app-failure.util';
import { toAppError } from 'src/utils/to-app-error.util';

vi.mock('src/assinafy-client/list-background-credentials', () => ({
  listBackgroundCredentials: vi.fn<typeof listBackgroundCredentials>(),
}));
vi.mock('src/assinafy-client/resolve-credential-account', () => ({
  resolveCredentialAccount: vi.fn<typeof resolveCredentialAccount>(),
}));
vi.mock('src/data/find-assinafy-document-by-request-id', () => ({
  findAssinafyDocumentByRequestId: vi.fn<typeof findAssinafyDocumentByRequestId>(),
}));
vi.mock('src/data/find-assinafy-documents', () => ({
  findAssinafyDocuments: vi.fn<typeof findAssinafyDocuments>(),
}));
vi.mock('src/data/find-attachment-file', () => ({ findAttachmentFile: vi.fn<typeof findAttachmentFile>() }));
vi.mock('src/data/find-contacts', () => ({ findContacts: vi.fn<typeof findContacts>() }));
vi.mock('src/data/find-crm-record', () => ({ findCrmRecord: vi.fn<typeof findCrmRecord>() }));
vi.mock('src/services/delete-unsent-upload.service', () => ({
  deleteUnsentUpload: vi.fn<typeof deleteUnsentUpload>(),
}));
vi.mock('src/services/list-template-summaries.service', () => ({
  listTemplateSummaries: vi.fn<typeof listTemplateSummaries>(),
}));
vi.mock('src/services/prepare-signature-request.service', () => ({
  prepareSignatureRequest: vi.fn<typeof prepareSignatureRequest>(),
}));
vi.mock('src/services/send-signature-request.service', () => ({
  sendSignatureRequest: vi.fn<typeof sendSignatureRequest>(),
}));

const OPPORTUNITY_ID = '11111111-1111-4111-8111-111111111111';
const PERSON_ID = '22222222-2222-4222-8222-222222222222';
const COMPANY_ID = '33333333-3333-4333-8333-333333333333';
const ATTACHMENT_ID = '44444444-4444-4444-8444-444444444444';
const SIGNER_1 = '55555555-5555-4555-8555-555555555555';
const SIGNER_2 = '66666666-6666-4666-8666-666666666666';
const REQUEST_ID = '77777777-7777-4777-8777-777777777777';
const apiKey = apiKeyCredential;
const resolved = buildResolved({}, 'acc-1', apiKey);
// Workflows run without a member.
const ctx = buildContext({ userWorkspaceId: null });
const { appCore, createAssinafyClient } = ctx;
const appCtx = expect.objectContaining({ userCore: appCore, appCore }) as unknown as HandlerContext;

const opportunity: CrmRecord = {
  objectNameSingular: 'opportunity',
  id: OPPORTUNITY_ID,
  name: 'Big deal',
  primaryContactPersonId: SIGNER_1,
  companyId: null,
};
const estimate = (overrides: Partial<CostEstimate> = {}): CostEstimate =>
  buildCostEstimate({ documents: 1, totalCredits: 0, documentBalance: 5, ...overrides });
const summary = { documentRecordId: 'doc-record-1', status: 'PENDING_SIGNATURE' } as DocumentSummary;
const template: TemplateSummary = {
  id: 'tpl-1',
  name: 'NDA',
  documentName: 'Mutual NDA',
  signerRoles: [
    { id: 'r-1', name: 'Client' },
    { id: 'r-2', name: 'Witness' },
  ],
  editorFields: [],
  unsupportedReason: null,
};
const pdfPayload = {
  attachment: { id: ATTACHMENT_ID, name: 'contract.pdf' },
  signers: [SIGNER_1, { id: SIGNER_2 }],
  opportunity: OPPORTUNITY_ID,
  person: PERSON_ID,
  expiresInDays: 7,
  maxCredits: 1,
};

const run = (payload: unknown, retryCount = 0) => sendForSignatureWorkflowHandler(payload, ctx, retryCount);

describe('sendForSignatureWorkflowHandler', () => {
  beforeEach(() => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(REQUEST_ID);
    vi.mocked(listBackgroundCredentials).mockResolvedValue([apiKey]);
    vi.mocked(resolveCredentialAccount).mockResolvedValue(resolved);
    vi.mocked(findCrmRecord).mockResolvedValue(opportunity);
    vi.mocked(findContacts).mockResolvedValue([
      { personId: SIGNER_1, name: 'Ada Lovelace', email: 'ada@example.invalid', phone: '+5511999990001' },
      { personId: SIGNER_2, name: 'Bob Stone', email: 'bob@example.invalid', phone: null },
    ]);
    vi.mocked(findAttachmentFile).mockResolvedValue({ name: 'contract.pdf', url: 'https://files.example.invalid/1' });
    vi.mocked(listTemplateSummaries).mockResolvedValue([template]);
    vi.mocked(prepareSignatureRequest).mockResolvedValue({
      accountId: 'acc-1',
      accountName: 'Acme',
      assinafyDocumentId: 'doc-1',
      estimate: estimate(),
    });
    vi.mocked(sendSignatureRequest).mockResolvedValue(summary);
    vi.mocked(findAssinafyDocumentByRequestId).mockResolvedValue(null);
    vi.mocked(findAssinafyDocuments).mockResolvedValue([]);
  });

  it('refuses a run with a retry count (job-runner retries) without calling Assinafy', async () => {
    await expect(run(pdfPayload, 1)).resolves.toEqual({
      ok: false,
      documentRecordId: null,
      status: null,
      errorCode: 'UNCERTAIN',
      errorMessage: expect.any(String),
    });
    expect(listBackgroundCredentials).not.toHaveBeenCalled();
    expect(prepareSignatureRequest).not.toHaveBeenCalled();
    expect(sendSignatureRequest).not.toHaveBeenCalled();
  });

  it('prepares and sends a PDF once with the background credential and the prepared estimate', async () => {
    await expect(run(pdfPayload)).resolves.toEqual({
      ok: true,
      documentRecordId: 'doc-record-1',
      status: 'PENDING_SIGNATURE',
      errorCode: null,
      errorMessage: null,
    });

    expect(resolveCredentialAccount).toHaveBeenCalledExactlyOnceWith(apiKey, createAssinafyClient);
    expect(findCrmRecord).toHaveBeenCalledWith(appCore, OPPORTUNITY_ID);
    expect(findContacts).toHaveBeenCalledWith(appCore, [SIGNER_1, SIGNER_2]);
    expect(findAttachmentFile).toHaveBeenCalledWith(appCore, opportunity, ATTACHMENT_ID);

    const request = {
      recordId: OPPORTUNITY_ID,
      source: { type: 'PDF', attachmentId: ATTACHMENT_ID },
      name: 'contract',
      signers: [
        {
          name: 'Ada Lovelace',
          email: 'ada@example.invalid',
          phone: '+5511999990001',
          verificationMethod: 'Email',
          notificationMethod: 'Email',
          governmentId: null,
          roleId: null,
        },
        {
          name: 'Bob Stone',
          email: 'bob@example.invalid',
          phone: null,
          verificationMethod: 'Email',
          notificationMethod: 'Email',
          governmentId: null,
          roleId: null,
        },
      ],
      message: null,
      expiresAt: '2026-10-02T12:00:00.000Z',
      sequential: false,
      assinafyDocumentId: null,
    };
    expect(prepareSignatureRequest).toHaveBeenCalledExactlyOnceWith(appCtx, request, resolved);
    expect(sendSignatureRequest).toHaveBeenCalledExactlyOnceWith(
      appCtx,
      {
        ...request,
        assinafyDocumentId: 'doc-1',
        requestId: REQUEST_ID,
        accountId: 'acc-1',
        expectedTotalCredits: 0,
        expectedDocuments: 1,
        deadlineMs: NOW.getTime() + 110_000,
      },
      resolved,
    );
    expect(deleteUnsentUpload).not.toHaveBeenCalled();
  });

  it('gives the send a deadline 10 s before the function timeout, so a billable call never outlives the run', async () => {
    await run(pdfPayload);

    expect(sendSignatureRequest).toHaveBeenCalledWith(
      appCtx,
      expect.objectContaining({ deadlineMs: NOW.getTime() + (120 - 10) * 1000 }),
      resolved,
    );
  });

  describe('a step Twenty re-runs after a platform failure (always with retry count 0)', () => {
    it.each(['SENDING', 'PENDING_SIGNATURE', 'UNCERTAIN'] as const)(
      'returns UNCERTAIN with the earlier %s record of the same document and record, sending nothing',
      async (status) => {
        vi.mocked(findAssinafyDocuments).mockResolvedValue([{ id: 'doc-record-0', status } as AssinafyDocumentRecord]);

        await expect(run(pdfPayload, 0)).resolves.toEqual({
          ok: false,
          documentRecordId: 'doc-record-0',
          status,
          errorCode: 'UNCERTAIN',
          errorMessage:
            'Uma tentativa anterior pode ter enviado esta solicitação. Confira na Assinafy antes de executar novamente.',
        });
        expect(findAssinafyDocuments).toHaveBeenCalledExactlyOnceWith(appCore, {
          filter: {
            or: [
              { personId: { eq: OPPORTUNITY_ID } },
              { companyId: { eq: OPPORTUNITY_ID } },
              { opportunityId: { eq: OPPORTUNITY_ID } },
            ],
            name: { eq: 'contract' },
            status: { neq: 'FAILED' },
            createdAt: { gte: new Date(NOW.getTime() - 180_000).toISOString() },
          },
          first: 1,
        });
        expect(prepareSignatureRequest).not.toHaveBeenCalled();
        expect(sendSignatureRequest).not.toHaveBeenCalled();
        expect(findAssinafyDocumentByRequestId).not.toHaveBeenCalled();
      },
    );

    it('fails closed, sending nothing, when earlier attempts cannot be read', async () => {
      vi.mocked(findAssinafyDocuments).mockRejectedValue(new Error('Twenty down'));

      const output = await run(pdfPayload);

      expect(output).toMatchObject({ ok: false, errorCode: 'INTERNAL' });
      expect(prepareSignatureRequest).not.toHaveBeenCalled();
      expect(sendSignatureRequest).not.toHaveBeenCalled();
    });
  });

  describe('shared connections without an API key', () => {
    const otherShared = { ...sharedCredential, connectionId: 'connection-2' } as typeof sharedCredential;

    beforeEach(() => {
      vi.mocked(listBackgroundCredentials).mockResolvedValue([sharedCredential, otherShared]);
    });

    it('refuses when they reach different Assinafy workspaces, before any upload', async () => {
      vi.mocked(resolveCredentialAccount)
        .mockResolvedValueOnce(buildResolved({}, 'acc-1', sharedCredential))
        .mockResolvedValueOnce(buildResolved({}, 'acc-2', otherShared));

      const output = await run(pdfPayload);

      expect(output).toMatchObject({ ok: false, errorCode: 'ACCOUNT_REQUIRED' });
      expect(prepareSignatureRequest).not.toHaveBeenCalled();
      expect(sendSignatureRequest).not.toHaveBeenCalled();
    });

    it('sends with the first one when they all reach the same workspace', async () => {
      const first = buildResolved({}, 'acc-1', sharedCredential);
      vi.mocked(resolveCredentialAccount)
        .mockResolvedValueOnce(first)
        .mockResolvedValueOnce(buildResolved({}, 'acc-1', otherShared));

      await expect(run(pdfPayload)).resolves.toMatchObject({ ok: true });

      expect(resolveCredentialAccount).toHaveBeenNthCalledWith(1, sharedCredential, createAssinafyClient);
      expect(resolveCredentialAccount).toHaveBeenNthCalledWith(2, otherShared, createAssinafyClient);
      expect(sendSignatureRequest).toHaveBeenCalledWith(appCtx, expect.anything(), first);
    });

    it('uses the API key alone when one is set', async () => {
      vi.mocked(listBackgroundCredentials).mockResolvedValue([apiKey, sharedCredential, otherShared]);

      await run(pdfPayload);

      expect(resolveCredentialAccount).toHaveBeenCalledExactlyOnceWith(apiKey, createAssinafyClient);
    });
  });

  it('compares the credit ceiling in cents', async () => {
    vi.mocked(prepareSignatureRequest).mockResolvedValue({
      accountId: 'acc-1',
      accountName: 'Acme',
      assinafyDocumentId: 'doc-1',
      estimate: estimate({ totalCredits: 0.3, documents: 0 }),
    });

    const output = await run({ ...pdfPayload, maxCredits: 0.1 + 0.2 });

    expect(output.ok).toBe(true);
    expect(sendSignatureRequest).toHaveBeenCalledWith(
      appCtx,
      expect.objectContaining({ expectedTotalCredits: 0.3, expectedDocuments: 0 }),
      resolved,
    );
  });

  it('stops above the credit ceiling and deletes the upload', async () => {
    vi.mocked(prepareSignatureRequest).mockResolvedValue({
      accountId: 'acc-1',
      accountName: 'Acme',
      assinafyDocumentId: 'doc-1',
      estimate: estimate({ totalCredits: 0.45 }),
    });

    await expect(run({ ...pdfPayload, maxCredits: undefined })).resolves.toEqual({
      ok: false,
      documentRecordId: null,
      status: null,
      errorCode: 'COST_LIMIT_EXCEEDED',
      errorMessage: expect.any(String),
    });
    expect(deleteUnsentUpload).toHaveBeenCalledExactlyOnceWith(resolved, 'doc-1', appCore);
    expect(sendSignatureRequest).not.toHaveBeenCalled();
  });

  it('stops when Assinafy reports insufficient documents or credits', async () => {
    vi.mocked(prepareSignatureRequest).mockResolvedValue({
      accountId: 'acc-1',
      accountName: 'Acme',
      assinafyDocumentId: 'doc-1',
      estimate: estimate({ sufficient: false, blockingReason: 'InsufficientDocuments' }),
    });

    const output = await run(pdfPayload);

    expect(output.errorCode).toBe('INSUFFICIENT_RESOURCES');
    expect(deleteUnsentUpload).toHaveBeenCalledWith(resolved, 'doc-1', appCore);
    expect(sendSignatureRequest).not.toHaveBeenCalled();
  });

  it('still reports the ceiling when deleting the upload fails', async () => {
    vi.mocked(prepareSignatureRequest).mockResolvedValue({
      accountId: 'acc-1',
      accountName: 'Acme',
      assinafyDocumentId: 'doc-1',
      estimate: estimate({ totalCredits: 2 }),
    });
    vi.mocked(deleteUnsentUpload).mockRejectedValue(new AppFailure('PROVIDER_UNAVAILABLE', 'Down'));

    const output = await run(pdfPayload);

    expect(output.errorCode).toBe('COST_LIMIT_EXCEEDED');
    expect(console.warn).toHaveBeenCalledWith('[assinafy] send-for-signature-workflow cleanup failed', {
      code: 'PROVIDER_UNAVAILABLE',
    });
  });

  it('logs an unexpected cleanup error as INTERNAL', async () => {
    vi.mocked(prepareSignatureRequest).mockResolvedValue({
      accountId: 'acc-1',
      accountName: 'Acme',
      assinafyDocumentId: 'doc-1',
      estimate: estimate({ totalCredits: 2 }),
    });
    vi.mocked(deleteUnsentUpload).mockRejectedValue(new Error('boom'));

    await run(pdfPayload);

    expect(console.warn).toHaveBeenCalledWith('[assinafy] send-for-signature-workflow cleanup failed', {
      code: 'INTERNAL',
    });
  });

  it('reports an uncertain send with its record and never sends again', async () => {
    vi.mocked(sendSignatureRequest).mockRejectedValue(new AppFailure('UNCERTAIN', 'Check Assinafy'));
    vi.mocked(findAssinafyDocumentByRequestId).mockResolvedValue({
      id: 'doc-record-1',
      status: 'UNCERTAIN',
    } as AssinafyDocumentRecord);

    await expect(run(pdfPayload)).resolves.toEqual({
      ok: false,
      documentRecordId: 'doc-record-1',
      status: 'UNCERTAIN',
      errorCode: 'UNCERTAIN',
      errorMessage: 'Check Assinafy',
    });
    expect(sendSignatureRequest).toHaveBeenCalledTimes(1);
    expect(findAssinafyDocumentByRequestId).toHaveBeenCalledWith(appCore, REQUEST_ID);
    expect(deleteUnsentUpload).not.toHaveBeenCalled();
  });

  it('deletes the upload when the estimate fails after it', async () => {
    vi.mocked(prepareSignatureRequest).mockRejectedValue(
      new AppFailure('RATE_LIMITED', 'Slow down', { assinafyDocumentId: 'doc-2', accountId: 'acc-1' }),
    );

    const output = await run(pdfPayload);

    expect(output.errorCode).toBe('RATE_LIMITED');
    expect(deleteUnsentUpload).toHaveBeenCalledExactlyOnceWith(resolved, 'doc-2', appCore);
    expect(sendSignatureRequest).not.toHaveBeenCalled();
  });

  it.each([new AppFailure('NOT_FOUND', 'Gone'), new TypeError('boom')])('deletes nothing when prepare fails before uploading (%s)', async (error) => {
    vi.mocked(prepareSignatureRequest).mockRejectedValue(error);

    await run(pdfPayload);

    expect(deleteUnsentUpload).not.toHaveBeenCalled();
  });

  it('deletes the upload when the send fails before claiming a record', async () => {
    vi.mocked(sendSignatureRequest).mockRejectedValue(new AppFailure('COST_CHANGED', 'Changed'));

    await run(pdfPayload);

    expect(deleteUnsentUpload).toHaveBeenCalledExactlyOnceWith(resolved, 'doc-1', appCore);
  });

  it('keeps the upload when the send outcome cannot be read', async () => {
    vi.mocked(sendSignatureRequest).mockRejectedValue(new AppFailure('PROVIDER_REJECTED', 'Invalid signer'));
    vi.mocked(findAssinafyDocumentByRequestId).mockRejectedValue(new Error('Twenty down'));

    await run(pdfPayload);

    expect(deleteUnsentUpload).not.toHaveBeenCalled();
  });

  it('leaves the upload to the purge when too little time is left', async () => {
    vi.mocked(sendSignatureRequest).mockRejectedValue(new AppFailure('PROVIDER_UNAVAILABLE', 'No time left'));
    vi.mocked(findAssinafyDocumentByRequestId).mockResolvedValue({ id: 'r', status: 'FAILED' } as AssinafyDocumentRecord);
    // The deadline is taken at the start; 80 s later only 30 s are left of it.
    const late = { ...ctx, now: vi.fn<() => Date>(() => new Date(NOW.getTime() + 80_000)).mockReturnValueOnce(NOW) };

    await sendForSignatureWorkflowHandler(pdfPayload, late, 0);

    expect(deleteUnsentUpload).not.toHaveBeenCalled();
  });

  it('reports a definitive failure with the FAILED record', async () => {
    vi.mocked(sendSignatureRequest).mockRejectedValue(new AppFailure('PROVIDER_REJECTED', 'Invalid signer'));
    vi.mocked(findAssinafyDocumentByRequestId).mockResolvedValue({
      id: 'doc-record-1',
      status: 'FAILED',
    } as AssinafyDocumentRecord);

    const output = await run(pdfPayload);

    expect(output).toMatchObject({
      ok: false,
      documentRecordId: 'doc-record-1',
      status: 'FAILED',
      errorCode: 'PROVIDER_REJECTED',
    });
    // Nothing was sent: the upload is deleted.
    expect(deleteUnsentUpload).toHaveBeenCalledExactlyOnceWith(resolved, 'doc-1', appCore);
  });

  it("gives the builder the app's refusal text when Assinafy's refusal has no message", async () => {
    vi.mocked(sendSignatureRequest).mockRejectedValue(
      toAppError(ApiError.fromResponse(413, '<html><title>413 Request Entity Too Large</title></html>'), 'mutation'),
    );

    const output = await run(pdfPayload);

    expect(output).toMatchObject({
      errorCode: 'PROVIDER_REJECTED',
      errorMessage: 'A Assinafy recusou o documento ou os dados dos signatários.',
    });
  });

  it('never throws, even when the failed record cannot be read', async () => {
    vi.mocked(sendSignatureRequest).mockRejectedValue(new Error('socket closed'));
    vi.mocked(findAssinafyDocumentByRequestId).mockRejectedValue(new Error('Twenty down'));

    await expect(run(pdfPayload)).resolves.toEqual({
      ok: false,
      documentRecordId: null,
      status: null,
      errorCode: 'INTERNAL',
      errorMessage: 'Erro inesperado.',
    });
  });

  it('answers INVALID_INPUT without touching Assinafy, naming the field by its form label', async () => {
    const output = await run({ signers: [SIGNER_1], person: PERSON_ID });

    expect(output).toMatchObject({
      errorCode: 'INVALID_INPUT',
      errorMessage: 'Campo "PDF anexado ou ID do modelo da Assinafy": obrigatório.',
    });
    expect(listBackgroundCredentials).not.toHaveBeenCalled();
  });

  it('keeps the field key for a field the form does not show', async () => {
    const output = await run({ ...pdfPayload, extra: 1 });

    expect(output).toMatchObject({ errorCode: 'INVALID_INPUT', errorMessage: 'Campo body.extra: campo desconhecido.' });
  });

  it('keeps the message of an INVALID_INPUT failure that names no field', async () => {
    vi.mocked(sendSignatureRequest).mockRejectedValue(new AppFailure('INVALID_INPUT', 'Os dados não são válidos.'));

    await expect(run(pdfPayload)).resolves.toMatchObject({
      errorCode: 'INVALID_INPUT',
      errorMessage: 'Os dados não são válidos.',
    });
  });

  it('answers NOT_CONNECTED without an API key or shared connection', async () => {
    vi.mocked(listBackgroundCredentials).mockResolvedValue([]);

    const output = await run(pdfPayload);

    expect(output.errorCode).toBe('NOT_CONNECTED');
    expect(resolveCredentialAccount).not.toHaveBeenCalled();
    expect(prepareSignatureRequest).not.toHaveBeenCalled();
  });

  it('links to the person when no opportunity is given, then to the company', async () => {
    await run({ ...pdfPayload, opportunity: null });
    expect(findCrmRecord).toHaveBeenLastCalledWith(appCore, PERSON_ID);

    await run({ ...pdfPayload, opportunity: null, person: null, company: COMPANY_ID });
    expect(findCrmRecord).toHaveBeenLastCalledWith(appCore, COMPANY_ID);
  });

  it('rejects a record the application cannot find', async () => {
    vi.mocked(findCrmRecord).mockResolvedValue(null);

    const output = await run(pdfPayload);

    expect(output).toMatchObject({ errorCode: 'INVALID_INPUT', errorMessage: 'Campo "Oportunidade, Pessoa ou Empresa": não encontrado.' });
    expect(prepareSignatureRequest).not.toHaveBeenCalled();
  });

  it('rejects signers that are not CRM people', async () => {
    vi.mocked(findContacts).mockResolvedValue([
      { personId: SIGNER_2, name: 'Bob Stone', email: 'bob@example.invalid', phone: null },
    ]);

    const output = await run(pdfPayload);

    expect(output).toMatchObject({
      errorCode: 'INVALID_INPUT',
      errorMessage: 'Campo "Signatários" (posição 1): não encontrado.',
    });
  });

  it('rejects an attachment that is not on the linked record', async () => {
    vi.mocked(findAttachmentFile).mockResolvedValue(null);

    const output = await run(pdfPayload);

    expect(output).toMatchObject({ errorCode: 'INVALID_INPUT', errorMessage: 'Campo "PDF anexado": não encontrado.' });
  });

  it('requires the WhatsApp number of every signer for WhatsApp verification', async () => {
    const output = await run({ ...pdfPayload, verificationMethod: 'WhatsApp' });

    expect(output).toMatchObject({
      errorCode: 'INVALID_INPUT',
      errorMessage: 'Campo "WhatsApp do signatário" (posição 2): obrigatório.',
    });
    expect(prepareSignatureRequest).not.toHaveBeenCalled();
  });

  it('uses the given name and falls back to a generic one', async () => {
    await run({ ...pdfPayload, name: 'Service agreement', message: 'Please sign' });
    expect(prepareSignatureRequest).toHaveBeenLastCalledWith(
      appCtx,
      expect.objectContaining({ name: 'Service agreement', message: 'Please sign' }),
      resolved,
    );

    vi.mocked(findAttachmentFile).mockResolvedValue({ name: '.pdf', url: 'https://files.example.invalid/1' });
    await run({ ...pdfPayload, expiresInDays: null });
    expect(prepareSignatureRequest).toHaveBeenLastCalledWith(
      appCtx,
      expect.objectContaining({ name: 'Documento', expiresAt: null }),
      resolved,
    );
  });

  describe('templates', () => {
    const templatePayload = { templateId: 'tpl-1', signers: [SIGNER_1, SIGNER_2], opportunity: OPPORTUNITY_ID };

    it('fills the signer roles in order and sends from the template', async () => {
      vi.mocked(prepareSignatureRequest).mockResolvedValue({
        accountId: 'acc-1',
        accountName: 'Acme',
        assinafyDocumentId: null,
        estimate: estimate(),
      });

      const output = await run(templatePayload);

      expect(output.ok).toBe(true);
      expect(listTemplateSummaries).toHaveBeenCalledWith(resolved.client);
      expect(findAttachmentFile).not.toHaveBeenCalled();
      expect(prepareSignatureRequest).toHaveBeenCalledWith(
        appCtx,
        expect.objectContaining({
          source: { type: 'TEMPLATE', templateId: 'tpl-1', editorFields: [] },
          name: 'Mutual NDA',
          signers: [expect.objectContaining({ roleId: 'r-1' }), expect.objectContaining({ roleId: 'r-2' })],
        }),
        resolved,
      );
      expect(sendSignatureRequest).toHaveBeenCalledWith(
        appCtx,
        expect.objectContaining({ assinafyDocumentId: null, requestId: REQUEST_ID }),
        resolved,
      );
    });

    it('names the document after the template when it has no document name', async () => {
      vi.mocked(listTemplateSummaries).mockResolvedValue([{ ...template, documentName: null }]);

      await run(templatePayload);

      expect(prepareSignatureRequest).toHaveBeenCalledWith(appCtx, expect.objectContaining({ name: 'NDA' }), resolved);
    });

    it('deletes nothing above the ceiling because nothing was uploaded', async () => {
      vi.mocked(prepareSignatureRequest).mockResolvedValue({
        accountId: 'acc-1',
        accountName: 'Acme',
        assinafyDocumentId: null,
        estimate: estimate({ totalCredits: 0.9 }),
      });

      const output = await run(templatePayload);

      expect(output.errorCode).toBe('COST_LIMIT_EXCEEDED');
      expect(deleteUnsentUpload).not.toHaveBeenCalled();
      expect(sendSignatureRequest).not.toHaveBeenCalled();
    });

    it('rejects an unknown template', async () => {
      const output = await run({ ...templatePayload, templateId: 'tpl-9' });

      expect(output).toMatchObject({ errorCode: 'INVALID_INPUT', errorMessage: 'Campo "ID do modelo da Assinafy": não encontrado.' });
    });

    it('rejects a signer count that does not match the template roles', async () => {
      vi.mocked(findContacts).mockResolvedValue([
        { personId: SIGNER_1, name: 'Ada Lovelace', email: 'ada@example.invalid', phone: null },
      ]);

      const output = await run({ ...templatePayload, signers: [SIGNER_1] });

      expect(output).toMatchObject({ errorCode: 'INVALID_INPUT', errorMessage: 'Campo "Signatários": a quantidade não corresponde aos papéis do modelo.' });
    });

    it('propagates a template listing failure', async () => {
      vi.mocked(listTemplateSummaries).mockRejectedValue(new AppFailure('PROVIDER_UNAVAILABLE', 'Down'));

      const output = await run(templatePayload);

      expect(output.errorCode).toBe('PROVIDER_UNAVAILABLE');
      expect(prepareSignatureRequest).not.toHaveBeenCalled();
    });
  });
});
