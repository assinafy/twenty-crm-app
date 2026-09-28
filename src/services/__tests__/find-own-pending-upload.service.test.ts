import { describe, expect, it, vi } from 'vitest';

vi.mock('src/services/read-pending-uploads.service', () => ({
  readPendingUploads: vi.fn<typeof readPendingUploads>(),
}));

import { pendingUpload } from 'src/services/__tests__/service-fixtures';
import { findOwnPendingUpload } from 'src/services/find-own-pending-upload.service';
import { readPendingUploads } from 'src/services/read-pending-uploads.service';

describe('findOwnPendingUpload', () => {
  it('finds the entry of an upload the member prepared in the workspace', async () => {
    vi.mocked(readPendingUploads).mockResolvedValue([pendingUpload({ documentId: 'doc-0' }), pendingUpload()]);

    await expect(findOwnPendingUpload('doc-1', 'account-1', 'member-1')).resolves.toEqual(pendingUpload());
  });

  it.each([
    ['another member', pendingUpload({ userWorkspaceId: 'member-2' })],
    ['a workflow', pendingUpload({ userWorkspaceId: null })],
    ['another workspace', pendingUpload({ accountId: 'account-2' })],
    ['another upload', pendingUpload({ documentId: 'doc-2' })],
  ])('ignores an entry of %s', async (_label, stored) => {
    vi.mocked(readPendingUploads).mockResolvedValue([stored]);

    await expect(findOwnPendingUpload('doc-1', 'account-1', 'member-1')).resolves.toBeUndefined();
  });

  it('never matches a workflow entry for a caller without a member', async () => {
    vi.mocked(readPendingUploads).mockResolvedValue([pendingUpload({ userWorkspaceId: null })]);

    await expect(findOwnPendingUpload('doc-1', 'account-1', null)).resolves.toBeUndefined();
    expect(readPendingUploads).not.toHaveBeenCalled();
  });
});
