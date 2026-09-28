import { listConnections } from 'twenty-sdk/logic-function';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LEAK_SENTINELS } from 'src/__tests__/setup/unit-test-setup';
import { buildAppConnection } from 'src/assinafy-client/__tests__/build-app-connection';
import { detectExpiredConnections } from 'src/assinafy-client/detect-expired-connections';
import { listInteractiveCredentials } from 'src/assinafy-client/list-interactive-credentials';

vi.mock('twenty-sdk/logic-function', () => ({ listConnections: vi.fn<typeof listConnections>() }));
vi.mock('src/assinafy-client/detect-expired-connections', () => ({
  detectExpiredConnections: vi.fn<typeof detectExpiredConnections>(),
}));

const list = vi.mocked(listConnections);
const detect = vi.mocked(detectExpiredConnections);

const API_KEY = LEAK_SENTINELS[1];
const ME = 'member-1';

const ownPersonal = buildAppConnection({ id: 'own-personal', userWorkspaceId: ME });
const ownShared = buildAppConnection({ id: 'own-shared', visibility: 'workspace', userWorkspaceId: ME });
const otherShared = buildAppConnection({ id: 'other-shared', visibility: 'workspace', userWorkspaceId: 'member-2' });
const otherPersonal = buildAppConnection({ id: 'other-personal', userWorkspaceId: 'member-2' });

const ids = (credentials: Awaited<ReturnType<typeof listInteractiveCredentials>>) =>
  credentials.map((credential) => (credential.kind === 'apiKey' ? 'api-key' : credential.connectionId));

describe('listInteractiveCredentials', () => {
  beforeEach(() => {
    detect.mockResolvedValue(undefined);
    vi.stubEnv('ASSINAFY_API_KEY', API_KEY);
    vi.stubEnv('ASSINAFY_ACCOUNT_ID', '');
  });

  it('lists own then shared connections sequentially with the exact filters', async () => {
    list.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await listInteractiveCredentials(ME);

    expect(list).toHaveBeenCalledTimes(2);
    expect(list).toHaveBeenNthCalledWith(1, { providerName: 'assinafy', userWorkspaceId: ME });
    expect(list).toHaveBeenNthCalledWith(2, { providerName: 'assinafy', visibility: 'workspace' });
  });

  it('orders own personal, own shared, other shared, then the API key, without duplicates', async () => {
    list.mockResolvedValueOnce([ownShared, ownPersonal]).mockResolvedValueOnce([otherShared, ownShared]);

    const credentials = await listInteractiveCredentials(ME);

    expect(ids(credentials)).toEqual(['own-personal', 'own-shared', 'other-shared', 'api-key']);
    expect(credentials[0]).toMatchObject({ kind: 'personal' });
    expect(credentials[1]).toMatchObject({ kind: 'shared' });
    expect(credentials[3]).toEqual({ kind: 'apiKey', apiKey: API_KEY, configuredAccountId: null });
  });

  it('never returns another member personal connection, whichever listing it comes from', async () => {
    list.mockResolvedValueOnce([otherPersonal, ownPersonal]).mockResolvedValueOnce([otherPersonal, otherShared]);

    const credentials = await listInteractiveCredentials(ME);

    expect(ids(credentials)).toEqual(['own-personal', 'other-shared', 'api-key']);
  });

  it('skips connections flagged as failed', async () => {
    const failed = { authFailedAt: '2026-09-01T00:00:00.000Z' };
    list
      .mockResolvedValueOnce([{ ...ownPersonal, ...failed }])
      .mockResolvedValueOnce([{ ...otherShared, ...failed }]);

    expect(ids(await listInteractiveCredentials(ME))).toEqual(['api-key']);
  });

  it('passes every listed shared connection to the expired-connection detection', async () => {
    list.mockResolvedValueOnce([ownPersonal]).mockResolvedValueOnce([otherShared, ownShared]);

    await listInteractiveCredentials(ME);

    expect(detect).toHaveBeenCalledExactlyOnceWith([otherShared, ownShared]);
  });

  it('returns nothing when no connection or API key exists', async () => {
    vi.stubEnv('ASSINAFY_API_KEY', '');
    list.mockResolvedValue([]);

    await expect(listInteractiveCredentials(ME)).resolves.toEqual([]);
  });

  it('fails with PROVIDER_UNAVAILABLE instead of the API key when the own listing fails', async () => {
    list.mockRejectedValueOnce(new Error('listConnections() failed: HTTP 500'));

    await expect(listInteractiveCredentials(ME)).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
    expect(list).toHaveBeenCalledTimes(1);
    expect(detect).not.toHaveBeenCalled();
  });

  it('fails with PROVIDER_UNAVAILABLE instead of the API key when the shared listing fails', async () => {
    list.mockResolvedValueOnce([ownPersonal]).mockRejectedValueOnce(new Error('listConnections() failed: HTTP 500'));

    await expect(listInteractiveCredentials(ME)).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
  });
});
