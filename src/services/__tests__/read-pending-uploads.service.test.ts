import { beforeEach, describe, expect, it, vi } from 'vitest';

const { store, kv } = await vi.hoisted(async () => (await import('src/services/__tests__/kv-store')).createKvStore());

vi.mock('twenty-sdk/logic-function', () => ({ kv }));

import { KV_PENDING_UPLOADS } from 'src/constants/kv-keys';
import { readPendingUploads } from 'src/services/read-pending-uploads.service';

describe('readPendingUploads', () => {
  beforeEach(() => store.clear());

  it('reads nothing when the key is unset or not a list', async () => {
    await expect(readPendingUploads()).resolves.toEqual([]);
    store.set(KV_PENDING_UPLOADS, { documentId: 'doc-1' });
    await expect(readPendingUploads()).resolves.toEqual([]);
  });

  it('keeps well-formed entries and drops the others', async () => {
    const entry = {
      documentId: 'doc-1',
      accountId: 'account-1',
      userWorkspaceId: 'member-1',
      createdAt: '2026-09-25T12:00:00.000Z',
    };
    store.set(KV_PENDING_UPLOADS, [
      entry,
      null,
      'doc-2',
      { documentId: 'doc-3', accountId: 'account-1' },
      { documentId: 'doc-4', createdAt: '2026-09-25T12:00:00.000Z' },
      { documentId: 'doc-5', accountId: 42, createdAt: '2026-09-25T12:00:00.000Z' },
      { documentId: 6, accountId: 'account-1', createdAt: '2026-09-25T12:00:00.000Z' },
    ]);

    await expect(readPendingUploads()).resolves.toEqual([entry]);
    expect(kv.get).toHaveBeenCalledWith(KV_PENDING_UPLOADS);
  });

  it.each([undefined, null, 42])('reads an entry whose member is %o as belonging to no member', async (member) => {
    const entry = { documentId: 'doc-1', accountId: 'account-1', createdAt: '2026-09-25T12:00:00.000Z' };
    store.set(KV_PENDING_UPLOADS, [{ ...entry, userWorkspaceId: member, extra: true }]);

    await expect(readPendingUploads()).resolves.toEqual([{ ...entry, userWorkspaceId: null }]);
  });
});
