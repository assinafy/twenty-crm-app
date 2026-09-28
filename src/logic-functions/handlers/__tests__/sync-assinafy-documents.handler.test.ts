import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildContext, NOW } from 'src/__tests__/fixtures/build-context';
import { buildDocumentRecord } from 'src/__tests__/fixtures/build-document-record';
import { listBackgroundCredentials } from 'src/assinafy-client/list-background-credentials';
import { resolveCredentialAccount } from 'src/assinafy-client/resolve-credential-account';
import {
  PENDING_UPLOAD_TTL_MS,
  SEND_LEASE_MS,
  SYNC_BATCH_SIZE,
  SYNC_BUDGET_RATIO,
  SYNC_TIMEOUT_SECONDS,
} from 'src/constants/limits';
import { findSyncableAssinafyDocuments } from 'src/data/find-syncable-assinafy-documents';
import { updateAssinafyDocument } from 'src/data/update-assinafy-document';
import {
  apiKeyCredential,
  buildResolved,
  sharedCredential,
} from 'src/logic-functions/handlers/__tests__/document-handler-fixtures';
import { syncAssinafyDocumentsHandler } from 'src/logic-functions/handlers/sync-assinafy-documents.handler';
import { purgePendingUploads } from 'src/services/purge-pending-uploads.service';
import { readPendingUploads } from 'src/services/read-pending-uploads.service';
import { syncAssinafyDocument } from 'src/services/sync-assinafy-document.service';
import { AppFailure } from 'src/utils/app-failure.util';

vi.mock('src/assinafy-client/list-background-credentials', () => ({ listBackgroundCredentials: vi.fn<typeof listBackgroundCredentials>() }));
vi.mock('src/assinafy-client/resolve-credential-account', () => ({ resolveCredentialAccount: vi.fn<typeof resolveCredentialAccount>() }));
vi.mock('src/data/find-syncable-assinafy-documents', () => ({ findSyncableAssinafyDocuments: vi.fn<typeof findSyncableAssinafyDocuments>() }));
vi.mock('src/data/update-assinafy-document', () => ({ updateAssinafyDocument: vi.fn<typeof updateAssinafyDocument>() }));
vi.mock('src/services/purge-pending-uploads.service', () => ({ purgePendingUploads: vi.fn<typeof purgePendingUploads>() }));
vi.mock('src/services/read-pending-uploads.service', () => ({ readPendingUploads: vi.fn<typeof readPendingUploads>() }));
vi.mock('src/services/sync-assinafy-document.service', () => ({ syncAssinafyDocument: vi.fn<typeof syncAssinafyDocument>() }));

const findSyncable = vi.mocked(findSyncableAssinafyDocuments);
const listCredentials = vi.mocked(listBackgroundCredentials);
const resolve = vi.mocked(resolveCredentialAccount);
const update = vi.mocked(updateAssinafyDocument);
const purge = vi.mocked(purgePendingUploads);
const sync = vi.mocked(syncAssinafyDocument);

const keyAccount = buildResolved({}, 'acc-1', apiKeyCredential);
const sharedAccount = buildResolved({}, 'acc-2', sharedCredential);
const BUDGET_MS = SYNC_BUDGET_RATIO * SYNC_TIMEOUT_SECONDS * 1000;
const at = (offsetMs: number) => new Date(NOW.getTime() + offsetMs);

const recordFor = (id: string, assinafyAccountId: string | null) => buildDocumentRecord({ id, assinafyAccountId });

describe('syncAssinafyDocumentsHandler', () => {
  beforeEach(() => {
    listCredentials.mockResolvedValue([apiKeyCredential, sharedCredential]);
    resolve.mockImplementation(async (credential) => (credential === apiKeyCredential ? keyAccount : sharedAccount));
    sync.mockImplementation(async (_ctx, record) => record);
    update.mockImplementation(async (_core, id) => buildDocumentRecord({ id }));
    purge.mockResolvedValue(2);
    vi.mocked(readPendingUploads).mockResolvedValue([]);
  });

  it('returns early without listing credentials or purging when nothing needs a sync', async () => {
    findSyncable.mockResolvedValue([]);
    const ctx = buildContext({ userWorkspaceId: null });

    await expect(syncAssinafyDocumentsHandler(ctx)).resolves.toEqual({
      found: 0,
      synced: 0,
      failed: 0,
      skipped: 0,
      purged: 0,
    });
    expect(findSyncable).toHaveBeenCalledWith(ctx.appCore, { now: NOW, limit: SYNC_BATCH_SIZE });
    expect(listCredentials).not.toHaveBeenCalled();
    expect(purge).not.toHaveBeenCalled();
  });

  it('purges uploads abandoned for 24 hours even when no record needs a sync', async () => {
    findSyncable.mockResolvedValue([]);
    vi.mocked(readPendingUploads).mockResolvedValue([
      { documentId: 'doc-old', accountId: 'acc-1', userWorkspaceId: null, createdAt: at(-PENDING_UPLOAD_TTL_MS).toISOString() },
    ]);

    await expect(syncAssinafyDocumentsHandler(buildContext({ userWorkspaceId: null }))).resolves.toMatchObject({
      found: 0,
      purged: 2,
    });
    expect(listCredentials).toHaveBeenCalledTimes(1);
    expect(purge).toHaveBeenCalledTimes(1);
  });

  it('does not list credentials for uploads still inside their 24 hours', async () => {
    findSyncable.mockResolvedValue([]);
    vi.mocked(readPendingUploads).mockResolvedValue([
      { documentId: 'doc-new', accountId: 'acc-1', userWorkspaceId: null, createdAt: at(-60 * 60 * 1000).toISOString() },
    ]);

    await syncAssinafyDocumentsHandler(buildContext({ userWorkspaceId: null }));

    expect(listCredentials).not.toHaveBeenCalled();
    expect(purge).not.toHaveBeenCalled();
  });

  it('syncs each record with the credential of its account, resolving every credential once', async () => {
    const records = [recordFor('r-1', 'acc-1'), recordFor('r-2', 'acc-2'), recordFor('r-3', 'acc-1')];
    findSyncable.mockResolvedValue(records);
    const ctx = buildContext({ userWorkspaceId: null });

    await expect(syncAssinafyDocumentsHandler(ctx)).resolves.toEqual({
      found: 3,
      synced: 3,
      failed: 0,
      skipped: 0,
      purged: 2,
    });
    expect(resolve).toHaveBeenCalledTimes(2);
    expect(resolve).toHaveBeenCalledWith(apiKeyCredential, ctx.createAssinafyClient);
    expect(resolve).toHaveBeenCalledWith(sharedCredential, ctx.createAssinafyClient);
    expect(sync.mock.calls).toEqual([
      [ctx, records[0], keyAccount],
      [ctx, records[1], sharedAccount],
      [ctx, records[2], keyAccount],
    ]);
    expect(purge).toHaveBeenCalledWith([keyAccount, sharedAccount], NOW, ctx.appCore);
  });

  it('marks records no credential can reach with NO_CREDENTIAL, as the app', async () => {
    findSyncable.mockResolvedValue([recordFor('r-1', 'acc-9'), recordFor('r-2', null), recordFor('r-3', 'acc-2')]);
    const ctx = buildContext({ userWorkspaceId: null });

    await expect(syncAssinafyDocumentsHandler(ctx)).resolves.toMatchObject({ synced: 1, skipped: 2, failed: 0 });
    const patch = { lastSyncedAt: NOW.toISOString(), lastError: 'NO_CREDENTIAL' };
    expect(update.mock.calls).toEqual([
      [ctx.appCore, 'r-1', patch],
      [ctx.appCore, 'r-2', patch],
    ]);
  });

  it('settles a send abandoned before Assinafy created its document without a credential', async () => {
    const abandoned = buildDocumentRecord({
      id: 'r-1',
      status: 'SENDING',
      assinafyDocumentId: null,
      assinafyAccountId: 'acc-9',
      updatedAt: at(-SEND_LEASE_MS - 1).toISOString(),
    });
    findSyncable.mockResolvedValue([abandoned]);
    const ctx = buildContext({ userWorkspaceId: null });

    await expect(syncAssinafyDocumentsHandler(ctx)).resolves.toMatchObject({ synced: 1, skipped: 0 });
    expect(sync).toHaveBeenCalledWith(ctx, abandoned, null);
    expect(update).not.toHaveBeenCalled();
  });

  it('skips a credential that fails to resolve and still purges with the others', async () => {
    resolve.mockImplementation(async (credential) => {
      if (credential === apiKeyCredential) throw new AppFailure('RECONNECT_REQUIRED', 'Rejected');
      return sharedAccount;
    });
    findSyncable.mockResolvedValue([recordFor('r-1', 'acc-1'), recordFor('r-2', 'acc-2')]);

    await expect(syncAssinafyDocumentsHandler(buildContext())).resolves.toMatchObject({ synced: 1, skipped: 1 });
    expect(console.warn).toHaveBeenCalledWith('[assinafy] sync-assinafy-documents: credential skipped', {
      code: 'RECONNECT_REQUIRED',
    });
    expect(purge).toHaveBeenCalledWith([sharedAccount], NOW, expect.anything());
  });

  it('marks every record NO_CREDENTIAL when the workspace has no background credential', async () => {
    listCredentials.mockResolvedValue([]);
    findSyncable.mockResolvedValue([recordFor('r-1', 'acc-1')]);

    await expect(syncAssinafyDocumentsHandler(buildContext())).resolves.toMatchObject({ skipped: 1, synced: 0 });
    expect(resolve).not.toHaveBeenCalled();
    expect(purge).toHaveBeenCalledWith([], NOW, expect.anything());
  });

  it('keeps going after a record fails to sync or to be marked', async () => {
    sync.mockRejectedValueOnce(new AppFailure('PROVIDER_UNAVAILABLE', 'Down'));
    update.mockRejectedValueOnce(new Error('GraphQL error'));
    findSyncable.mockResolvedValue([recordFor('r-1', 'acc-1'), recordFor('r-2', 'acc-9'), recordFor('r-3', 'acc-2')]);

    await expect(syncAssinafyDocumentsHandler(buildContext())).resolves.toEqual({
      found: 3,
      synced: 1,
      failed: 2,
      skipped: 0,
      purged: 2,
    });
    expect(sync).toHaveBeenCalledTimes(2);
    expect(console.warn).toHaveBeenCalledWith('[assinafy] sync-assinafy-documents: record failed', {
      code: 'PROVIDER_UNAVAILABLE',
    });
    expect(console.warn).toHaveBeenCalledWith('[assinafy] sync-assinafy-documents: record failed', {
      code: 'INTERNAL',
    });
  });

  it('stops once the time budget is spent, then purges', async () => {
    findSyncable.mockResolvedValue([recordFor('r-1', 'acc-1'), recordFor('r-2', 'acc-1'), recordFor('r-3', 'acc-1')]);
    const now = vi
      .fn<() => Date>()
      .mockReturnValueOnce(NOW)
      .mockReturnValueOnce(at(1_000))
      .mockReturnValueOnce(at(BUDGET_MS - 1))
      .mockReturnValueOnce(at(BUDGET_MS))
      .mockReturnValue(at(BUDGET_MS + 500));

    await expect(syncAssinafyDocumentsHandler(buildContext({ now }))).resolves.toMatchObject({
      found: 3,
      synced: 2,
      failed: 0,
    });
    expect(sync).toHaveBeenCalledTimes(2);
    expect(purge).toHaveBeenCalledWith(expect.any(Array), at(BUDGET_MS + 500), expect.anything());
  });

  it('propagates a failure to list the credentials', async () => {
    findSyncable.mockResolvedValue([recordFor('r-1', 'acc-1')]);
    listCredentials.mockRejectedValue(new AppFailure('PROVIDER_UNAVAILABLE', 'Down'));

    await expect(syncAssinafyDocumentsHandler(buildContext())).rejects.toMatchObject({
      code: 'PROVIDER_UNAVAILABLE',
    });
    expect(sync).not.toHaveBeenCalled();
  });
});
