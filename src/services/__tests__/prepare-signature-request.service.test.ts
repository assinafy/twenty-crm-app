import { ApiError, NetworkError } from '@assinafy/sdk';
import { describe, expect, it, vi } from 'vitest';

vi.mock('src/data/find-crm-record', () => ({ findCrmRecord: vi.fn<typeof findCrmRecord>() }));
vi.mock('src/data/find-attachment-file', () => ({ findAttachmentFile: vi.fn<typeof findAttachmentFile>() }));
vi.mock('src/assinafy-client/select-send-credential', () => ({
  selectSendCredential: vi.fn<typeof selectSendCredential>(),
}));
vi.mock('src/services/fetch-attachment-pdf.service', () => ({ fetchAttachmentPdf: vi.fn<typeof fetchAttachmentPdf>() }));
vi.mock('src/services/remember-pending-upload.service', () => ({
  rememberPendingUpload: vi.fn<typeof rememberPendingUpload>(),
}));
vi.mock('src/services/read-pending-uploads.service', () => ({
  readPendingUploads: vi.fn<typeof readPendingUploads>(),
}));

import { buildContext, NOW } from 'src/__tests__/fixtures/build-context';
import { selectSendCredential } from 'src/assinafy-client/select-send-credential';
import { findAttachmentFile } from 'src/data/find-attachment-file';
import { PENDING_UPLOAD_SEND_CUTOFF_MS } from 'src/constants/limits';
import { findCrmRecord } from 'src/data/find-crm-record';
import {
  assignment,
  ATTACHMENT_ID,
  costEstimate,
  crmRecord,
  documentDetails,
  fakeAssinafyClient,
  pdfInput,
  pendingUpload,
  RECORD_ID,
  resolvedCredential,
  templateInput,
  templateItem,
} from 'src/services/__tests__/service-fixtures';
import { fetchAttachmentPdf } from 'src/services/fetch-attachment-pdf.service';
import { prepareSignatureRequest } from 'src/services/prepare-signature-request.service';
import { readPendingUploads } from 'src/services/read-pending-uploads.service';
import { rememberPendingUpload } from 'src/services/remember-pending-upload.service';
import { AppFailure } from 'src/utils/app-failure.util';
import { invalidInput } from 'src/utils/invalid-input.util';

const PDF = { buffer: Buffer.from('%PDF-1.7'), fileName: 'document.pdf' };
const FILE = { name: 'Contract.pdf', url: 'https://files.test.invalid/contract.pdf' };
const setup = () => {
  const fake = fakeAssinafyClient();
  const resolved = resolvedCredential(fake.client);
  const ctx = buildContext();
  vi.mocked(findCrmRecord).mockResolvedValue(crmRecord());
  vi.mocked(findAttachmentFile).mockResolvedValue(FILE);
  vi.mocked(selectSendCredential).mockResolvedValue(resolved);
  vi.mocked(fetchAttachmentPdf).mockResolvedValue(PDF);
  fake.documents.upload.mockResolvedValue({ id: 'doc-new' });
  fake.assignments.estimateCost.mockResolvedValue(costEstimate());
  vi.mocked(readPendingUploads).mockResolvedValue([pendingUpload()]);
  return { fake, resolved, ctx };
};

describe('prepareSignatureRequest', () => {
  it('fails with NOT_FOUND when the person cannot read the record', async () => {
    const { ctx } = setup();
    vi.mocked(findCrmRecord).mockResolvedValue(null);

    await expect(prepareSignatureRequest(ctx, pdfInput())).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(findCrmRecord).toHaveBeenCalledWith(ctx.userCore, RECORD_ID);
    expect(selectSendCredential).not.toHaveBeenCalled();
  });

  it('uploads the attachment under the document name, remembers it and estimates it', async () => {
    const { fake, ctx } = setup();

    await expect(prepareSignatureRequest(ctx, pdfInput())).resolves.toEqual({
      accountId: 'account-1',
      accountName: 'Acme workspace',
      assinafyDocumentId: 'doc-new',
      estimate: expect.objectContaining({ documents: 1, totalCredits: 0, sufficient: true }),
    });
    expect(findAttachmentFile).toHaveBeenCalledWith(ctx.userCore, crmRecord(), ATTACHMENT_ID);
    expect(fetchAttachmentPdf).toHaveBeenCalledWith(FILE);
    expect(fake.documents.upload).toHaveBeenCalledExactlyOnceWith(PDF, { name: 'Service agreement' });
    expect(rememberPendingUpload).toHaveBeenCalledWith(
      { documentId: 'doc-new', accountId: 'account-1', userWorkspaceId: 'member-1' },
      NOW,
    );
    expect(fake.assignments.estimateCost).toHaveBeenCalledWith('doc-new', expect.anything());
  });

  it('downloads the attachment before choosing the Assinafy credential', async () => {
    const { ctx } = setup();

    await prepareSignatureRequest(ctx, pdfInput());

    expect(vi.mocked(fetchAttachmentPdf).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(selectSendCredential).mock.invocationCallOrder[0]!,
    );
  });

  it('fails with NOT_FOUND when the attachment is not on the record, before any Assinafy call', async () => {
    const { fake, ctx } = setup();
    vi.mocked(findAttachmentFile).mockResolvedValue(null);

    await expect(prepareSignatureRequest(ctx, pdfInput())).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(fetchAttachmentPdf).not.toHaveBeenCalled();
    expect(selectSendCredential).not.toHaveBeenCalled();
    expect(fake.documents.upload).not.toHaveBeenCalled();
  });

  it('rejects an attachment that is not a PDF before any Assinafy call', async () => {
    const { fake, ctx } = setup();
    vi.mocked(fetchAttachmentPdf).mockRejectedValue(invalidInput('source.attachmentId', 'NOT_A_PDF'));

    await expect(prepareSignatureRequest(ctx, pdfInput())).rejects.toMatchObject({
      code: 'INVALID_INPUT',
      details: { field: 'source.attachmentId', reason: 'NOT_A_PDF' },
    });
    expect(selectSendCredential).not.toHaveBeenCalled();
    expect(fake.documents.upload).not.toHaveBeenCalled();
  });

  it('maps an upload failure as a mutation and remembers nothing', async () => {
    const { fake, ctx } = setup();
    fake.documents.upload.mockRejectedValue(new NetworkError('timeout'));

    await expect(prepareSignatureRequest(ctx, pdfInput())).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
    expect(rememberPendingUpload).not.toHaveBeenCalled();
  });

  it('returns the upload with a failed estimate so the next attempt reuses it', async () => {
    const { fake, ctx } = setup();
    fake.assignments.estimateCost.mockRejectedValue(new ApiError('Server error', 502));

    const failure = await prepareSignatureRequest(ctx, pdfInput()).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(AppFailure);
    expect(failure).toMatchObject({
      code: 'PROVIDER_UNAVAILABLE',
      details: { assinafyDocumentId: 'doc-new', accountId: 'account-1' },
    });
    expect(rememberPendingUpload).toHaveBeenCalledTimes(1);
  });

  it('keeps the failure details next to the upload', async () => {
    const { fake, ctx } = setup();
    fake.assignments.estimateCost.mockRejectedValue(new AppFailure('RATE_LIMITED', 'Slow down', { retryAfter: 5 }));

    await expect(prepareSignatureRequest(ctx, pdfInput())).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      message: 'Slow down',
      details: { retryAfter: 5, assinafyDocumentId: 'doc-new', accountId: 'account-1' },
    });
  });

  it('re-estimates an unsent upload of the same workspace without uploading again', async () => {
    const { fake, ctx } = setup();
    fake.documents.details.mockResolvedValue(documentDetails({ id: 'doc-1', status: 'uploaded' }));

    await expect(prepareSignatureRequest(ctx, pdfInput({ assinafyDocumentId: 'doc-1' }))).resolves.toMatchObject({
      assinafyDocumentId: 'doc-1',
    });
    expect(fake.documents.details).toHaveBeenCalledWith('doc-1');
    expect(fake.assignments.estimateCost).toHaveBeenCalledWith('doc-1', expect.anything());
    expect(findAttachmentFile).not.toHaveBeenCalled();
    expect(fake.documents.upload).not.toHaveBeenCalled();
  });

  it.each([
    ['another workspace', documentDetails({ account_id: 'account-2' })],
    ['an assigned upload', documentDetails({ assignment: assignment() })],
    ['a document past draft', documentDetails({ status: 'pending_signature' })],
  ])('refuses to reuse %s', async (_label, details) => {
    const { fake, ctx } = setup();
    fake.documents.details.mockResolvedValue(details);

    await expect(prepareSignatureRequest(ctx, pdfInput({ assinafyDocumentId: 'doc-1' }))).rejects.toMatchObject({
      code: 'INVALID_STATE',
    });
    expect(fake.assignments.estimateCost).not.toHaveBeenCalled();
  });

  it.each([
    ['another member', [pendingUpload({ userWorkspaceId: 'member-2' })]],
    ['a workflow', [pendingUpload({ userWorkspaceId: null })]],
    ['another workspace', [pendingUpload({ accountId: 'account-2' })]],
    ['nobody (a lost entry)', []],
    ['the member, but too close to the purge', [pendingUpload({ createdAt: new Date(NOW.getTime() - PENDING_UPLOAD_SEND_CUTOFF_MS).toISOString() })]],
  ])('refuses to reuse an upload prepared by %s before any Assinafy call', async (_label, entries) => {
    const { fake, ctx } = setup();
    vi.mocked(readPendingUploads).mockResolvedValue(entries);

    await expect(prepareSignatureRequest(ctx, pdfInput({ assinafyDocumentId: 'doc-1' }))).rejects.toMatchObject({
      code: 'INVALID_STATE',
    });
    expect(fake.documents.details).not.toHaveBeenCalled();
    expect(fake.assignments.estimateCost).not.toHaveBeenCalled();
  });

  it('reuses the member upload until just before the send cutoff', async () => {
    const { fake, ctx } = setup();
    fake.documents.details.mockResolvedValue(documentDetails({ id: 'doc-1', status: 'uploaded' }));
    vi.mocked(readPendingUploads).mockResolvedValue([
      pendingUpload({ createdAt: new Date(NOW.getTime() - PENDING_UPLOAD_SEND_CUTOFF_MS + 1).toISOString() }),
    ]);

    await expect(prepareSignatureRequest(ctx, pdfInput({ assinafyDocumentId: 'doc-1' }))).resolves.toMatchObject({
      assinafyDocumentId: 'doc-1',
    });
  });

  it('refuses a member reuse without a member', async () => {
    const { fake, ctx } = setup();

    await expect(
      prepareSignatureRequest({ ...ctx, userWorkspaceId: null }, pdfInput({ assinafyDocumentId: 'doc-1' })),
    ).rejects.toMatchObject({ code: 'INVALID_STATE' });
    expect(fake.documents.details).not.toHaveBeenCalled();
  });

  it('lets a background caller reuse an upload without a pending-upload entry', async () => {
    const { fake, resolved, ctx } = setup();
    fake.documents.details.mockResolvedValue(documentDetails({ id: 'doc-1', status: 'uploaded' }));
    vi.mocked(readPendingUploads).mockResolvedValue([]);

    await expect(
      prepareSignatureRequest({ ...ctx, userWorkspaceId: null }, pdfInput({ assinafyDocumentId: 'doc-1' }), resolved),
    ).resolves.toMatchObject({ assinafyDocumentId: 'doc-1' });
    expect(readPendingUploads).not.toHaveBeenCalled();
  });

  it('reports a reused upload Assinafy no longer has', async () => {
    const { fake, ctx } = setup();
    fake.documents.details.mockRejectedValue(new ApiError('Not found', 404));

    await expect(prepareSignatureRequest(ctx, pdfInput({ assinafyDocumentId: 'doc-1' }))).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('validates the live template once, then estimates it without uploading anything', async () => {
    const { fake, ctx } = setup();
    fake.templates.list.mockResolvedValue({ data: [templateItem()] });
    fake.documents.estimateCostFromTemplate.mockResolvedValue(costEstimate({ total_credits: 2 }));

    await expect(prepareSignatureRequest(ctx, templateInput())).resolves.toMatchObject({
      assinafyDocumentId: null,
      estimate: { totalCredits: 2 },
    });
    expect(fake.templates.list).toHaveBeenCalledTimes(1);
    expect(findAttachmentFile).not.toHaveBeenCalled();
    expect(fake.documents.upload).not.toHaveBeenCalled();
  });

  it('does not estimate a template the input does not match', async () => {
    const { fake, ctx } = setup();
    fake.templates.list.mockResolvedValue({ data: [templateItem({ status: 'Uploaded' })] });

    await expect(prepareSignatureRequest(ctx, templateInput())).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect(fake.documents.estimateCostFromTemplate).not.toHaveBeenCalled();
  });

  it('uses the credential a background caller passes instead of the member one', async () => {
    const { resolved, ctx } = setup();

    await prepareSignatureRequest({ ...ctx, userWorkspaceId: null }, pdfInput(), resolved);

    expect(selectSendCredential).not.toHaveBeenCalled();
  });

  it('remembers an upload made with a passed credential as belonging to no member', async () => {
    const { resolved, ctx } = setup();

    await prepareSignatureRequest(ctx, pdfInput(), resolved);

    expect(rememberPendingUpload).toHaveBeenCalledWith(
      { documentId: 'doc-new', accountId: 'account-1', userWorkspaceId: null },
      NOW,
    );
  });
});
