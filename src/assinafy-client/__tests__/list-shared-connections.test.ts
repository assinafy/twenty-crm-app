import { listConnections } from 'twenty-sdk/logic-function';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildAppConnection } from 'src/assinafy-client/__tests__/build-app-connection';
import { detectExpiredConnections } from 'src/assinafy-client/detect-expired-connections';
import { listSharedConnections } from 'src/assinafy-client/list-shared-connections';

vi.mock('twenty-sdk/logic-function', () => ({ listConnections: vi.fn<typeof listConnections>() }));
vi.mock('src/assinafy-client/detect-expired-connections', () => ({
  detectExpiredConnections: vi.fn<typeof detectExpiredConnections>(),
}));

const list = vi.mocked(listConnections);
const detect = vi.mocked(detectExpiredConnections);

describe('listSharedConnections', () => {
  beforeEach(() => {
    detect.mockResolvedValue(undefined);
  });

  it('lists workspace connections, passes every listed one to detection and returns the usable ones', async () => {
    const usable = buildAppConnection({ id: 'shared-ok', visibility: 'workspace' });
    const failed = buildAppConnection({ id: 'shared-failed', visibility: 'workspace', authFailedAt: '2026-09-01' });
    const personal = buildAppConnection({ id: 'personal' });
    list.mockResolvedValue([usable, failed, personal]);

    await expect(listSharedConnections()).resolves.toEqual([usable]);
    expect(list).toHaveBeenCalledExactlyOnceWith({ providerName: 'assinafy', visibility: 'workspace' });
    expect(detect).toHaveBeenCalledExactlyOnceWith([personal, failed, usable]);
  });

  it('checks for expired connections when nothing usable is listed', async () => {
    list.mockResolvedValue([]);

    await expect(listSharedConnections()).resolves.toEqual([]);
    expect(detect).toHaveBeenCalledExactlyOnceWith([]);
  });

  it('propagates a listing failure without running detection', async () => {
    list.mockRejectedValue(new Error('down'));

    await expect(listSharedConnections()).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
    expect(detect).not.toHaveBeenCalled();
  });
});
