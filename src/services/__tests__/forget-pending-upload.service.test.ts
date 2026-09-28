import { beforeEach, describe, expect, it, vi } from 'vitest';

const { store, kv } = await vi.hoisted(async () => (await import('src/services/__tests__/kv-store')).createKvStore());

vi.mock('twenty-sdk/logic-function', () => ({ kv }));

import { KV_PENDING_UPLOADS } from 'src/constants/kv-keys';
import { forgetPendingUpload } from 'src/services/forget-pending-upload.service';

const entry = (documentId: string) => ({
  documentId,
  accountId: 'account-1',
  userWorkspaceId: 'member-1',
  createdAt: '2026-09-24T12:00:00.000Z',
});

describe('forgetPendingUpload', () => {
  beforeEach(() => store.clear());

  it('drops the upload', async () => {
    store.set(KV_PENDING_UPLOADS, [entry('doc-1'), entry('doc-2')]);

    await forgetPendingUpload('doc-1');

    expect(store.get(KV_PENDING_UPLOADS)).toEqual([entry('doc-2')]);
  });

  it('writes nothing when the upload is not remembered', async () => {
    store.set(KV_PENDING_UPLOADS, [entry('doc-2')]);

    await forgetPendingUpload('doc-1');

    expect(kv.set).not.toHaveBeenCalled();
  });

  it.each([
    [new Error('kv down'), 'Error'],
    ['kv down', 'string'],
  ])('never throws (%o)', async (error, name) => {
    kv.get.mockRejectedValueOnce(error);

    await expect(forgetPendingUpload('doc-1')).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith('[assinafy] forgetPendingUpload failed', { name });
  });
});
