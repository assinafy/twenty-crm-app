import { type AssinafyClient } from '@assinafy/sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildContext } from 'src/__tests__/fixtures/build-context';
import { LEAK_SENTINELS } from 'src/__tests__/setup/unit-test-setup';
import { selectDocumentCredential } from 'src/assinafy-client/select-document-credential';
import { PENDING_UPLOAD_TTL_MS } from 'src/constants/limits';
import { discardUploadHandler } from 'src/logic-functions/handlers/discard-upload.handler';
import { assertSendableUpload } from 'src/services/assert-sendable-upload.service';
import { deleteUnsentUpload } from 'src/services/delete-unsent-upload.service';
import { forgetPendingUpload } from 'src/services/forget-pending-upload.service';
import { readPendingUploads } from 'src/services/read-pending-uploads.service';
import { type AssinafyCredential } from 'src/types/assinafy-credential';
import { type MemberHandlerContext } from 'src/types/member-handler-context';
import { type ResolvedCredential } from 'src/types/resolved-credential';
import { AppFailure } from 'src/utils/app-failure.util';

vi.mock('src/assinafy-client/select-document-credential', () => ({
  selectDocumentCredential: vi.fn<typeof selectDocumentCredential>(),
}));
vi.mock('src/services/delete-unsent-upload.service', () => ({
  deleteUnsentUpload: vi.fn<typeof deleteUnsentUpload>(),
}));
vi.mock('src/services/read-pending-uploads.service', () => ({
  readPendingUploads: vi.fn<typeof readPendingUploads>(),
}));
vi.mock('src/services/forget-pending-upload.service', () => ({
  forgetPendingUpload: vi.fn<typeof forgetPendingUpload>(),
}));

const credential: AssinafyCredential = {
  kind: 'personal',
  connectionId: 'c-1',
  accessToken: LEAK_SENTINELS[0],
  scopes: [],
};
const resolved: ResolvedCredential = {
  credential,
  accountId: 'acc-1',
  accountName: 'Acme',
  client: {} as AssinafyClient,
};
const ctx = buildContext() as MemberHandlerContext;
const pending = {
  documentId: 'doc-1',
  accountId: 'acc-1',
  userWorkspaceId: 'member-1',
  createdAt: '2026-09-25T12:00:00.000Z',
};
const aged = (age: number) => ({ ...pending, createdAt: new Date(ctx.now().getTime() - age).toISOString() });

describe('discardUploadHandler', () => {
  beforeEach(() => {
    vi.mocked(readPendingUploads).mockResolvedValue([pending]);
  });

  it('never deletes a fresh upload while a concurrent send can still accept it', async () => {
    vi.mocked(selectDocumentCredential).mockResolvedValue(resolved);

    await expect(Promise.all([
      discardUploadHandler({ assinafyDocumentId: 'doc-1', accountId: 'acc-1' }, ctx),
      assertSendableUpload('doc-1', 'acc-1', ctx.userWorkspaceId, ctx.now()),
    ])).resolves.toEqual([{}, undefined]);

    expect(vi.mocked(deleteUnsentUpload).mock.calls).toHaveLength(0);
    expect(selectDocumentCredential).not.toHaveBeenCalled();
    expect(forgetPendingUpload).not.toHaveBeenCalled();
    expect(await readPendingUploads()).toEqual([pending]);
  });

  it.each([0, PENDING_UPLOAD_TTL_MS - 1])('keeps a %i ms old upload queued without requiring credentials', async (age) => {
    const entry = aged(age);
    vi.mocked(readPendingUploads).mockResolvedValue([entry]);
    vi.mocked(selectDocumentCredential).mockRejectedValue(new AppFailure('NOT_CONNECTED', 'No credential'));

    await expect(discardUploadHandler({ assinafyDocumentId: 'doc-1', accountId: 'acc-1' }, ctx)).resolves.toEqual({});

    expect(selectDocumentCredential).not.toHaveBeenCalled();
    expect(deleteUnsentUpload).not.toHaveBeenCalled();
    expect(forgetPendingUpload).not.toHaveBeenCalled();
    expect(await readPendingUploads()).toEqual([entry]);
  });

  it.each([PENDING_UPLOAD_TTL_MS, PENDING_UPLOAD_TTL_MS + 1])('deletes a %i ms old upload with its workspace credential', async (age) => {
    vi.mocked(readPendingUploads).mockResolvedValue([aged(age)]);
    vi.mocked(selectDocumentCredential).mockResolvedValue(resolved);

    await expect(discardUploadHandler({ assinafyDocumentId: 'doc-1', accountId: 'acc-1' }, ctx)).resolves.toEqual({});
    expect(selectDocumentCredential).toHaveBeenCalledWith(ctx, 'acc-1');
    expect(deleteUnsentUpload).toHaveBeenCalledWith(resolved, 'doc-1', ctx.appCore);
  });

  it.each(['not-a-date', ''])('refuses an invalid creation timestamp %j before resolving credentials', async (createdAt) => {
    const entry = { ...pending, createdAt };
    vi.mocked(readPendingUploads).mockResolvedValue([entry]);

    await expect(discardUploadHandler({ assinafyDocumentId: 'doc-1', accountId: 'acc-1' }, ctx)).rejects.toMatchObject({ code: 'INVALID_STATE' });

    expect(selectDocumentCredential).not.toHaveBeenCalled();
    expect(deleteUnsentUpload).not.toHaveBeenCalled();
    expect(forgetPendingUpload).not.toHaveBeenCalled();
    expect(await readPendingUploads()).toEqual([entry]);
  });

  it.each([
    ['another member prepared', { userWorkspaceId: 'member-2' }],
    ['a workflow prepared', { userWorkspaceId: null }],
    ['belongs to another Assinafy workspace', { accountId: 'acc-2' }],
    ['the app did not prepare', { documentId: 'doc-2' }],
  ])('refuses an upload %s, before any Assinafy call', async (_label, overrides) => {
    vi.mocked(readPendingUploads).mockResolvedValue([{ ...pending, ...overrides }]);

    await expect(discardUploadHandler({ assinafyDocumentId: 'doc-1', accountId: 'acc-1' }, ctx)).rejects.toMatchObject({
      code: 'INVALID_STATE',
    });
    expect(selectDocumentCredential).not.toHaveBeenCalled();
    expect(deleteUnsentUpload).not.toHaveBeenCalled();
  });

  it('deletes nothing when no credential reaches the workspace', async () => {
    vi.mocked(readPendingUploads).mockResolvedValue([{ ...aged(PENDING_UPLOAD_TTL_MS), accountId: 'acc-9' }]);
    vi.mocked(selectDocumentCredential).mockRejectedValue(new AppFailure('FORBIDDEN', 'No access'));

    await expect(discardUploadHandler({ assinafyDocumentId: 'doc-1', accountId: 'acc-9' }, ctx)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(deleteUnsentUpload).not.toHaveBeenCalled();
  });
});
