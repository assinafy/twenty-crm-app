import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildContext, NOW } from 'src/__tests__/fixtures/build-context';
import { buildDocumentRecord } from 'src/__tests__/fixtures/build-document-record';
import { selectDocumentCredential } from 'src/assinafy-client/select-document-credential';
import { SEND_LEASE_MS } from 'src/constants/limits';
import { findAssinafyDocument } from 'src/data/find-assinafy-document';
import { buildResolved, DOCUMENT_RECORD_ID } from 'src/logic-functions/handlers/__tests__/document-handler-fixtures';
import { refreshDocumentHandler } from 'src/logic-functions/handlers/refresh-document.handler';
import { syncAssinafyDocument } from 'src/services/sync-assinafy-document.service';
import { type MemberHandlerContext } from 'src/types/member-handler-context';
import { AppFailure } from 'src/utils/app-failure.util';
import { toDocumentSummary } from 'src/utils/to-document-summary.util';

vi.mock('src/assinafy-client/select-document-credential', () => ({ selectDocumentCredential: vi.fn<typeof selectDocumentCredential>() }));
vi.mock('src/data/find-assinafy-document', () => ({ findAssinafyDocument: vi.fn<typeof findAssinafyDocument>() }));
vi.mock('src/services/sync-assinafy-document.service', () => ({ syncAssinafyDocument: vi.fn<typeof syncAssinafyDocument>() }));

const findDocument = vi.mocked(findAssinafyDocument);
const selectCredential = vi.mocked(selectDocumentCredential);
const sync = vi.mocked(syncAssinafyDocument);

const input = { documentRecordId: DOCUMENT_RECORD_ID };
const resolved = buildResolved();
// The logic function has already required a signed-in member.
const memberContext = () => buildContext() as MemberHandlerContext;

describe('refreshDocumentHandler', () => {
  beforeEach(() => {
    selectCredential.mockResolvedValue(resolved);
  });

  it('answers NOT_FOUND when the member cannot read the record', async () => {
    findDocument.mockResolvedValue(null);

    await expect(refreshDocumentHandler(input, memberContext())).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('reads the record as the member, syncs it with the credential of its account and returns the summary', async () => {
    const record = buildDocumentRecord();
    const synced = buildDocumentRecord({ status: 'CERTIFICATED', signedCount: 1 });
    findDocument.mockResolvedValue(record);
    sync.mockResolvedValue(synced);
    const ctx = memberContext();

    await expect(refreshDocumentHandler(input, ctx)).resolves.toEqual(toDocumentSummary(synced));

    expect(findDocument).toHaveBeenCalledWith(ctx.userCore, DOCUMENT_RECORD_ID);
    expect(selectCredential).toHaveBeenCalledWith(ctx, 'acc-1');
    expect(sync).toHaveBeenCalledWith(ctx, record, resolved);
  });

  it.each([
    ['a template send still in progress', { status: 'SENDING' as const, updatedAt: NOW.toISOString() }],
    ['a document that never reached Assinafy', { status: 'UNCERTAIN' as const }],
    ['a failed send', { status: 'FAILED' as const }],
  ])('returns %s unchanged without calling Assinafy', async (_label, overrides) => {
    const record = buildDocumentRecord({ assinafyDocumentId: null, ...overrides });
    findDocument.mockResolvedValue(record);

    await expect(refreshDocumentHandler(input, memberContext())).resolves.toEqual(toDocumentSummary(record));
    expect(selectCredential).not.toHaveBeenCalled();
    expect(sync).not.toHaveBeenCalled();
  });

  it('returns a record without an Assinafy account unchanged', async () => {
    const record = buildDocumentRecord({ assinafyAccountId: null });
    findDocument.mockResolvedValue(record);

    await expect(refreshDocumentHandler(input, memberContext())).resolves.toEqual(toDocumentSummary(record));
    expect(sync).not.toHaveBeenCalled();
  });

  it('hands a send abandoned past its lease to the sync, which marks it UNCERTAIN', async () => {
    const record = buildDocumentRecord({
      assinafyDocumentId: null,
      status: 'SENDING',
      updatedAt: new Date(NOW.getTime() - SEND_LEASE_MS - 1).toISOString(),
    });
    const uncertain = buildDocumentRecord({ ...record, status: 'UNCERTAIN', lastError: 'UNCERTAIN' });
    findDocument.mockResolvedValue(record);
    sync.mockResolvedValue(uncertain);

    selectCredential.mockRejectedValue(new AppFailure('FORBIDDEN', 'No credential', { accountId: 'acc-1' }));

    await expect(refreshDocumentHandler(input, memberContext())).resolves.toMatchObject({ status: 'UNCERTAIN' });
    // Settling it needs no Assinafy call, so a member without a credential for its account settles it too.
    expect(sync).toHaveBeenCalledWith(expect.anything(), record, null);
    expect(selectCredential).not.toHaveBeenCalled();
  });

  it('returns a failed send with its upload unchanged, keeping why it failed', async () => {
    const record = buildDocumentRecord({ status: 'FAILED', lastError: 'PROVIDER_REJECTED' });
    findDocument.mockResolvedValue(record);

    await expect(refreshDocumentHandler(input, memberContext())).resolves.toEqual(toDocumentSummary(record));
    expect(record.assinafyDocumentId).not.toBeNull();
    expect(selectCredential).not.toHaveBeenCalled();
    expect(sync).not.toHaveBeenCalled();
  });

  it('propagates credential failures such as FORBIDDEN for another workspace', async () => {
    findDocument.mockResolvedValue(buildDocumentRecord());
    selectCredential.mockRejectedValue(new AppFailure('FORBIDDEN', 'No credential', { accountId: 'acc-1' }));

    await expect(refreshDocumentHandler(input, memberContext())).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(sync).not.toHaveBeenCalled();
  });
});
