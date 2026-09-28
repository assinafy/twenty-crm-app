import { ApiError, type AssinafyClient, type IDocumentDetailsResponse, NetworkError } from '@assinafy/sdk';
import { type CoreApiClient } from 'twenty-client-sdk/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LEAK_SENTINELS } from 'src/__tests__/setup/unit-test-setup';
import { findUploadReference } from 'src/data/find-upload-reference';
import { documentRecord } from 'src/services/__tests__/service-fixtures';
import { deleteUnsentUpload } from 'src/services/delete-unsent-upload.service';
import { forgetPendingUpload } from 'src/services/forget-pending-upload.service';
import { type ResolvedCredential } from 'src/types/resolved-credential';

vi.mock('src/data/find-upload-reference', () => ({ findUploadReference: vi.fn<typeof findUploadReference>() }));
vi.mock('src/services/forget-pending-upload.service', () => ({
  forgetPendingUpload: vi.fn<typeof forgetPendingUpload>(),
}));

const appCore = {} as CoreApiClient;
const referenced = vi.mocked(findUploadReference);
const details = vi.fn<AssinafyClient['documents']['details']>();
const remove = vi.fn<AssinafyClient['documents']['delete']>();
const draft = (overrides: Partial<IDocumentDetailsResponse>) =>
  ({
    id: 'doc-1',
    account_id: 'acc-1',
    status: 'uploaded',
    assignment: null,
    ...overrides,
  }) as IDocumentDetailsResponse;
const resolved: ResolvedCredential = {
  credential: { kind: 'apiKey', apiKey: LEAK_SENTINELS[1], configuredAccountId: null },
  accountId: 'acc-1',
  accountName: 'Acme',
  client: { documents: { details, delete: remove } } as unknown as AssinafyClient,
};

describe('deleteUnsentUpload', () => {
  beforeEach(() => {
    details.mockResolvedValue(draft({}));
    remove.mockResolvedValue(undefined);
    referenced.mockResolvedValue(null);
  });

  it('deletes an unassigned upload of the account and forgets it', async () => {
    await deleteUnsentUpload(resolved, 'doc-1', appCore);

    expect(details).toHaveBeenCalledWith('doc-1');
    expect(referenced).toHaveBeenCalledExactlyOnceWith(appCore, 'doc-1');
    expect(remove).toHaveBeenCalledExactlyOnceWith('doc-1');
    expect(forgetPendingUpload).toHaveBeenCalledWith('doc-1');
  });

  it('checks the records after Assinafy, right before the delete', async () => {
    await deleteUnsentUpload(resolved, 'doc-1', appCore);

    const checkedAt = referenced.mock.invocationCallOrder[0] ?? Infinity;
    expect(checkedAt).toBeGreaterThan(details.mock.invocationCallOrder[0] ?? Infinity);
    expect(checkedAt).toBeLessThan(remove.mock.invocationCallOrder[0] ?? -Infinity);
  });

  it('refuses an upload a send record points at and keeps it remembered', async () => {
    referenced.mockResolvedValue(documentRecord());

    await expect(deleteUnsentUpload(resolved, 'doc-1', appCore)).rejects.toMatchObject({ code: 'INVALID_STATE' });
    expect(remove).not.toHaveBeenCalled();
    expect(forgetPendingUpload).not.toHaveBeenCalled();
  });

  it('deletes nothing when the record check fails', async () => {
    referenced.mockRejectedValue(new Error('GraphQL error'));

    await expect(deleteUnsentUpload(resolved, 'doc-1', appCore)).rejects.toMatchObject({ code: 'INTERNAL' });
    expect(remove).not.toHaveBeenCalled();
    expect(forgetPendingUpload).not.toHaveBeenCalled();
  });

  it('refuses a document that was sent', async () => {
    details.mockResolvedValue(
      draft({ status: 'pending_signature', assignment: { id: 'a-1' } as IDocumentDetailsResponse['assignment'] }),
    );

    await expect(deleteUnsentUpload(resolved, 'doc-1', appCore)).rejects.toMatchObject({ code: 'INVALID_STATE' });
    expect(referenced).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(forgetPendingUpload).not.toHaveBeenCalled();
  });

  it('refuses a document past its draft statuses', async () => {
    details.mockResolvedValue(draft({ status: 'expired' }));

    await expect(deleteUnsentUpload(resolved, 'doc-1', appCore)).rejects.toMatchObject({ code: 'INVALID_STATE' });
    expect(remove).not.toHaveBeenCalled();
  });

  it('refuses a document of another Assinafy workspace', async () => {
    details.mockResolvedValue(draft({ account_id: 'acc-2' }));

    await expect(deleteUnsentUpload(resolved, 'doc-1', appCore)).rejects.toMatchObject({ code: 'INVALID_STATE' });
    expect(remove).not.toHaveBeenCalled();
  });

  it('forgets an upload Assinafy no longer has', async () => {
    details.mockRejectedValue(new ApiError('Not found', 404));

    await deleteUnsentUpload(resolved, 'doc-1', appCore);

    expect(remove).not.toHaveBeenCalled();
    expect(forgetPendingUpload).toHaveBeenCalledWith('doc-1');
  });

  it('keeps an upload still processing remembered for the purge', async () => {
    remove.mockRejectedValue(new ApiError('Document cannot be deleted', 400));

    await expect(deleteUnsentUpload(resolved, 'doc-1', appCore)).resolves.toBeUndefined();
    expect(forgetPendingUpload).not.toHaveBeenCalled();
  });

  it('maps other failures and keeps the upload remembered', async () => {
    remove.mockRejectedValue(new NetworkError('socket hang up'));

    await expect(deleteUnsentUpload(resolved, 'doc-1', appCore)).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
    expect(forgetPendingUpload).not.toHaveBeenCalled();
  });

  it.each([
    [new ApiError('Forbidden', 403), 'FORBIDDEN'],
    [new ApiError('Server error', 500), 'PROVIDER_UNAVAILABLE'],
    [new ApiError('Unauthorized', 401), 'RECONNECT_REQUIRED'],
  ])('maps a delete answered with %s to %s and keeps the upload remembered', async (error, code) => {
    remove.mockRejectedValue(error);

    await expect(deleteUnsentUpload(resolved, 'doc-1', appCore)).rejects.toMatchObject({ code });
    expect(forgetPendingUpload).not.toHaveBeenCalled();
  });

  it('maps a refused details read and neither deletes nor forgets the upload', async () => {
    details.mockRejectedValue(new ApiError('Forbidden', 403));

    await expect(deleteUnsentUpload(resolved, 'doc-1', appCore)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(remove).not.toHaveBeenCalled();
    expect(forgetPendingUpload).not.toHaveBeenCalled();
  });

  it('deletes an unassigned upload whose Assinafy processing failed', async () => {
    details.mockResolvedValue(draft({ status: 'failed' }));

    await deleteUnsentUpload(resolved, 'doc-1', appCore);

    expect(remove).toHaveBeenCalledExactlyOnceWith('doc-1');
    expect(forgetPendingUpload).toHaveBeenCalledWith('doc-1');
  });
});
