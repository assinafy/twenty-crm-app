import { beforeEach, describe, expect, it, vi } from 'vitest';

const { store, kv } = await vi.hoisted(async () => (await import('src/services/__tests__/kv-store')).createKvStore());

vi.mock('twenty-sdk/logic-function', () => ({ kv }));

import { NOW } from 'src/__tests__/fixtures/build-context';
import { KV_PENDING_UPLOADS } from 'src/constants/kv-keys';
import { MAX_PENDING_UPLOADS } from 'src/constants/limits';
import { rememberPendingUpload } from 'src/services/remember-pending-upload.service';

const entry = (documentId: string, createdAt = '2026-09-24T12:00:00.000Z') => ({
  documentId,
  accountId: 'account-1',
  userWorkspaceId: 'member-1',
  createdAt,
});
const upload = (documentId: string) => ({ documentId, accountId: 'account-1', userWorkspaceId: 'member-1' });

describe('rememberPendingUpload', () => {
  beforeEach(() => store.clear());

  it('appends the upload with its creation time', async () => {
    store.set(KV_PENDING_UPLOADS, [entry('doc-1')]);

    await rememberPendingUpload(upload('doc-2'), NOW);

    expect(store.get(KV_PENDING_UPLOADS)).toEqual([entry('doc-1'), entry('doc-2', NOW.toISOString())]);
  });

  it('remembers a workflow upload as belonging to no member', async () => {
    await rememberPendingUpload({ ...upload('doc-1'), userWorkspaceId: null }, NOW);

    expect(store.get(KV_PENDING_UPLOADS)).toEqual([{ ...entry('doc-1', NOW.toISOString()), userWorkspaceId: null }]);
  });

  it('moves an upload remembered again to the newest position', async () => {
    store.set(KV_PENDING_UPLOADS, [entry('doc-1'), entry('doc-2')]);

    await rememberPendingUpload(upload('doc-1'), NOW);

    expect(store.get(KV_PENDING_UPLOADS)).toEqual([entry('doc-2'), entry('doc-1', NOW.toISOString())]);
  });

  it(`keeps only the newest ${MAX_PENDING_UPLOADS} uploads`, async () => {
    store.set(
      KV_PENDING_UPLOADS,
      Array.from({ length: MAX_PENDING_UPLOADS }, (_, index) => entry(`doc-${index}`)),
    );

    await rememberPendingUpload(upload('doc-new'), NOW);

    const stored = store.get(KV_PENDING_UPLOADS) as Array<{ documentId: string }>;
    expect(stored).toHaveLength(MAX_PENDING_UPLOADS);
    expect(stored[0]?.documentId).toBe('doc-1');
    expect(stored.at(-1)?.documentId).toBe('doc-new');
    expect(console.warn).toHaveBeenCalledWith('[assinafy] rememberPendingUpload evicted entries', {
      code: 'PENDING_UPLOADS_EVICTED',
      count: 1,
    });
  });

  it('warns about nothing while the list has room', async () => {
    store.set(
      KV_PENDING_UPLOADS,
      Array.from({ length: MAX_PENDING_UPLOADS - 1 }, (_, index) => entry(`doc-${index}`)),
    );

    await rememberPendingUpload(upload('doc-new'), NOW);

    expect(store.get(KV_PENDING_UPLOADS)).toHaveLength(MAX_PENDING_UPLOADS);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it.each([
    [new Error('kv down'), 'Error'],
    ['kv down', 'string'],
  ])('never throws (%o)', async (error, name) => {
    kv.set.mockRejectedValueOnce(error);

    await expect(rememberPendingUpload(upload('doc-1'), NOW)).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith('[assinafy] rememberPendingUpload failed', { name });
  });
});
