import { describe, expect, it, vi } from 'vitest';

vi.mock('src/services/read-pending-uploads.service', () => ({
  readPendingUploads: vi.fn<typeof readPendingUploads>(),
}));

import { NOW } from 'src/__tests__/fixtures/build-context';
import { PENDING_UPLOAD_SEND_CUTOFF_MS, PENDING_UPLOAD_TTL_MS, SEND_TIMEOUT_SECONDS } from 'src/constants/limits';
import { pendingUpload } from 'src/services/__tests__/service-fixtures';
import { assertSendableUpload } from 'src/services/assert-sendable-upload.service';
import { readPendingUploads } from 'src/services/read-pending-uploads.service';

const aged = (ms: number) => pendingUpload({ createdAt: new Date(NOW.getTime() - ms).toISOString() });

describe('assertSendableUpload', () => {
  it('leaves a send far more time than it can run before the purge looks at the upload', () => {
    expect(PENDING_UPLOAD_TTL_MS - PENDING_UPLOAD_SEND_CUTOFF_MS).toBeGreaterThanOrEqual(10 * SEND_TIMEOUT_SECONDS * 1000);
  });

  it('accepts the member upload until just before the cutoff', async () => {
    vi.mocked(readPendingUploads).mockResolvedValue([aged(PENDING_UPLOAD_SEND_CUTOFF_MS - 1)]);

    await expect(assertSendableUpload('doc-1', 'account-1', 'member-1', NOW)).resolves.toBeUndefined();
  });

  it.each([
    ['at the cutoff', [aged(PENDING_UPLOAD_SEND_CUTOFF_MS)]],
    ['without an entry', []],
    ['prepared by another member', [{ ...aged(0), userWorkspaceId: 'member-2' }]],
  ])('refuses an upload %s', async (_label, entries) => {
    vi.mocked(readPendingUploads).mockResolvedValue(entries);

    await expect(assertSendableUpload('doc-1', 'account-1', 'member-1', NOW)).rejects.toMatchObject({
      code: 'INVALID_STATE',
    });
  });
});
