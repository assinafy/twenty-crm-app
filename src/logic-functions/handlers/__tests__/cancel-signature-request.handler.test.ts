import { ApiError, NetworkError } from '@assinafy/sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildContext, NOW } from 'src/__tests__/fixtures/build-context';
import { buildDocumentRecord } from 'src/__tests__/fixtures/build-document-record';
import { selectDocumentCredential } from 'src/assinafy-client/select-document-credential';
import { assertCanUpdateAssinafyDocument } from 'src/data/assert-can-update-assinafy-document';
import { findAssinafyDocument } from 'src/data/find-assinafy-document';
import { updateAssinafyDocument } from 'src/data/update-assinafy-document';
import { cancelSignatureRequestHandler } from 'src/logic-functions/handlers/cancel-signature-request.handler';
import { buildResolved, DOCUMENT_RECORD_ID } from 'src/logic-functions/handlers/__tests__/document-handler-fixtures';
import { syncAssinafyDocument } from 'src/services/sync-assinafy-document.service';
import { type AssinafyDocumentRecord } from 'src/types/assinafy-document-record';
import { type MemberHandlerContext } from 'src/types/member-handler-context';
import { AppFailure } from 'src/utils/app-failure.util';
import { toDocumentSummary } from 'src/utils/to-document-summary.util';

vi.mock('src/assinafy-client/select-document-credential', () => ({ selectDocumentCredential: vi.fn<typeof selectDocumentCredential>() }));
vi.mock('src/data/assert-can-update-assinafy-document', () => ({
  assertCanUpdateAssinafyDocument: vi.fn<typeof assertCanUpdateAssinafyDocument>(),
}));
vi.mock('src/data/find-assinafy-document', () => ({ findAssinafyDocument: vi.fn<typeof findAssinafyDocument>() }));
vi.mock('src/data/update-assinafy-document', () => ({ updateAssinafyDocument: vi.fn<typeof updateAssinafyDocument>() }));
vi.mock('src/services/sync-assinafy-document.service', () => ({ syncAssinafyDocument: vi.fn<typeof syncAssinafyDocument>() }));

const assertCanUpdate = vi.mocked(assertCanUpdateAssinafyDocument);
const findDocument = vi.mocked(findAssinafyDocument);
const updateDocument = vi.mocked(updateAssinafyDocument);
const selectCredential = vi.mocked(selectDocumentCredential);
const sync = vi.mocked(syncAssinafyDocument);

const deleteDocument = vi.fn<(documentId: string) => Promise<void>>();
const resolved = buildResolved({ documents: { delete: deleteDocument } });
const input = { documentRecordId: DOCUMENT_RECORD_ID };
// The logic function has already required a signed-in member.
const memberContext = () => buildContext() as MemberHandlerContext;

describe('cancelSignatureRequestHandler', () => {
  let record: AssinafyDocumentRecord;

  beforeEach(() => {
    record = buildDocumentRecord();
    findDocument.mockResolvedValue(record);
    assertCanUpdate.mockResolvedValue(undefined);
    selectCredential.mockResolvedValue(resolved);
    deleteDocument.mockResolvedValue(undefined);
    updateDocument.mockImplementation(async (_core, _id, patch) => ({ ...record, ...patch }));
    sync.mockResolvedValue(record);
  });

  it('answers NOT_FOUND when the member cannot read the record', async () => {
    findDocument.mockResolvedValue(null);

    await expect(cancelSignatureRequestHandler(input, memberContext())).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it.each<[string, Partial<AssinafyDocumentRecord>]>([
    ['signed', { status: 'CERTIFICATED' }],
    ['uncertain', { status: 'UNCERTAIN' }],
    ['still sending', { status: 'SENDING' }],
    ['missing its Assinafy document', { assinafyDocumentId: null }],
    ['missing its Assinafy account', { assinafyAccountId: null }],
  ])('answers INVALID_STATE without calling Assinafy for a document %s', async (_label, overrides) => {
    findDocument.mockResolvedValue(buildDocumentRecord(overrides));

    await expect(cancelSignatureRequestHandler(input, memberContext())).rejects.toMatchObject({
      code: 'INVALID_STATE',
    });
    expect(assertCanUpdate).not.toHaveBeenCalled();
    expect(selectCredential).not.toHaveBeenCalled();
    expect(deleteDocument).not.toHaveBeenCalled();
  });

  it('answers FORBIDDEN without calling Assinafy when the member role cannot update the record', async () => {
    const ctx = memberContext();
    assertCanUpdate.mockRejectedValue(new AppFailure('FORBIDDEN', 'Sua função no Twenty não permite alterar este documento.'));

    await expect(cancelSignatureRequestHandler(input, ctx)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(assertCanUpdate).toHaveBeenCalledWith(ctx.userCore, record);
    expect(selectCredential).not.toHaveBeenCalled();
    expect(deleteDocument).not.toHaveBeenCalled();
    expect(updateDocument).not.toHaveBeenCalled();
  });

  it('deletes the document with the credential of its account and stores CANCELLED as the app', async () => {
    const ctx = memberContext();
    const patch = {
      status: 'CANCELLED',
      completedAt: NOW.toISOString(),
      lastSyncedAt: NOW.toISOString(),
      lastError: null,
    };

    await expect(cancelSignatureRequestHandler(input, ctx)).resolves.toEqual(
      toDocumentSummary({ ...record, ...patch, status: 'CANCELLED' }),
    );
    expect(findDocument).toHaveBeenCalledWith(ctx.userCore, DOCUMENT_RECORD_ID);
    expect(selectCredential).toHaveBeenCalledWith(ctx, 'acc-1');
    expect(deleteDocument).toHaveBeenCalledWith('doc-1');
    expect(updateDocument).toHaveBeenCalledWith(ctx.appCore, DOCUMENT_RECORD_ID, patch);
    expect(sync).not.toHaveBeenCalled();
  });

  it('keeps an existing completion date', async () => {
    findDocument.mockResolvedValue(buildDocumentRecord({ completedAt: '2026-09-21T00:00:00.000Z' }));

    await cancelSignatureRequestHandler(input, memberContext());

    expect(updateDocument).toHaveBeenCalledWith(
      expect.anything(),
      DOCUMENT_RECORD_ID,
      expect.objectContaining({ completedAt: '2026-09-21T00:00:00.000Z' }),
    );
  });

  it('treats a document already gone in Assinafy as cancelled', async () => {
    deleteDocument.mockRejectedValue(new ApiError('Not found', 404));

    await expect(cancelSignatureRequestHandler(input, memberContext())).resolves.toMatchObject({ status: 'CANCELLED' });
    expect(updateDocument).toHaveBeenCalledTimes(1);
  });

  it('re-syncs and asks to retry shortly when Assinafy refuses to delete a PDF still pending', async () => {
    deleteDocument.mockRejectedValue(new ApiError('Document cannot be deleted in status uploaded', 400));
    const ctx = memberContext();

    await expect(cancelSignatureRequestHandler(input, ctx)).rejects.toMatchObject({
      code: 'PROVIDER_REJECTED',
      message: 'A Assinafy ainda não permite cancelar este documento. Se ele acabou de ser enviado, tente novamente em instantes.',
      // The app's own text: the front end shows it without the provider prefix.
      details: undefined,
    });
    expect(sync).toHaveBeenCalledWith(ctx, record, resolved);
    expect(updateDocument).not.toHaveBeenCalled();
  });

  it('asks to cancel in Assinafy when Assinafy refuses to delete a template document', async () => {
    record = buildDocumentRecord({ templateName: 'Contrato' });
    findDocument.mockResolvedValue(record);
    sync.mockResolvedValue(record);
    deleteDocument.mockRejectedValue(new ApiError('Template assignment prevents direct deletion', 400));

    await expect(cancelSignatureRequestHandler(input, memberContext())).rejects.toMatchObject({
      code: 'PROVIDER_REJECTED',
      message: 'A Assinafy não permitiu cancelar este documento por aqui. Cancele-o na Assinafy.',
      // The app's own text: the front end shows it without the provider prefix.
      details: undefined,
    });
  });

  it.each(['CERTIFICATING', 'CERTIFICATED', 'REJECTED_BY_SIGNER', 'EXPIRED'] as const)(
    'answers INVALID_STATE when the refusal comes from a document now %s in Assinafy',
    async (status) => {
      deleteDocument.mockRejectedValue(new ApiError('Document cannot be deleted', 400));
      sync.mockResolvedValue(buildDocumentRecord({ status }));

      await expect(cancelSignatureRequestHandler(input, memberContext())).rejects.toMatchObject({
        code: 'INVALID_STATE',
        message: 'O documento mudou na Assinafy e não pode mais ser cancelado.',
      });
      expect(updateDocument).not.toHaveBeenCalled();
    },
  );

  it('keeps the refusal when the re-sync fails too', async () => {
    deleteDocument.mockRejectedValue(new ApiError('Refused', 400));
    sync.mockRejectedValue(new NetworkError('down'));

    await expect(cancelSignatureRequestHandler(input, memberContext())).rejects.toMatchObject({
      code: 'PROVIDER_REJECTED',
    });
  });

  it.each([
    ['a network error', new NetworkError('socket hang up')],
    ['HTTP 500', new ApiError('Server error', 500)],
    ['HTTP 503', new ApiError('Unavailable', 503)],
  ])('answers PROVIDER_UNAVAILABLE after %s and leaves the record alone', async (_label, error) => {
    deleteDocument.mockRejectedValue(error);

    await expect(cancelSignatureRequestHandler(input, memberContext())).rejects.toMatchObject({
      code: 'PROVIDER_UNAVAILABLE',
    });
    expect(updateDocument).not.toHaveBeenCalled();
    expect(sync).not.toHaveBeenCalled();
  });

  it.each([
    [401, 'RECONNECT_REQUIRED'],
    [403, 'FORBIDDEN'],
    [429, 'RATE_LIMITED'],
  ])('propagates HTTP %i as %s', async (status, code) => {
    deleteDocument.mockRejectedValue(new ApiError('Refused', status));

    await expect(cancelSignatureRequestHandler(input, memberContext())).rejects.toMatchObject({ code });
    expect(updateDocument).not.toHaveBeenCalled();
  });
});
