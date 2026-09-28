import { listConnections } from 'twenty-sdk/logic-function';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LEAK_SENTINELS } from 'src/__tests__/setup/unit-test-setup';
import { buildAppConnection } from 'src/assinafy-client/__tests__/build-app-connection';
import { detectExpiredConnections } from 'src/assinafy-client/detect-expired-connections';
import { listBackgroundCredentials } from 'src/assinafy-client/list-background-credentials';

vi.mock('twenty-sdk/logic-function', () => ({ listConnections: vi.fn<typeof listConnections>() }));
vi.mock('src/assinafy-client/detect-expired-connections', () => ({
  detectExpiredConnections: vi.fn<typeof detectExpiredConnections>(),
}));

const list = vi.mocked(listConnections);
const detect = vi.mocked(detectExpiredConnections);

const API_KEY = LEAK_SENTINELS[1];

describe('listBackgroundCredentials', () => {
  beforeEach(() => {
    detect.mockResolvedValue(undefined);
  });

  it('returns the API key first, then usable shared connections, never personal ones', async () => {
    vi.stubEnv('ASSINAFY_API_KEY', API_KEY);
    vi.stubEnv('ASSINAFY_ACCOUNT_ID', 'acc-1');
    list.mockResolvedValue([
      buildAppConnection({ id: 'shared', visibility: 'workspace' }),
      buildAppConnection({ id: 'personal' }),
      buildAppConnection({ id: 'failed', visibility: 'workspace', authFailedAt: '2026-09-01T00:00:00.000Z' }),
    ]);

    const credentials = await listBackgroundCredentials();

    expect(credentials).toEqual([
      { kind: 'apiKey', apiKey: API_KEY, configuredAccountId: 'acc-1' },
      { kind: 'shared', connectionId: 'shared', accessToken: LEAK_SENTINELS[0], scopes: ['documents:read'] },
    ]);
    expect(list).toHaveBeenCalledExactlyOnceWith({ providerName: 'assinafy', visibility: 'workspace' });
    expect(detect).toHaveBeenCalledExactlyOnceWith(
      ['failed', 'personal', 'shared'].map((id) => expect.objectContaining({ id })),
    );
  });

  it('returns only shared connections without an API key', async () => {
    vi.stubEnv('ASSINAFY_API_KEY', '');
    list.mockResolvedValue([buildAppConnection({ id: 'shared', visibility: 'workspace' })]);

    expect((await listBackgroundCredentials()).map((credential) => credential.kind)).toEqual(['shared']);
  });

  it('fails with PROVIDER_UNAVAILABLE instead of falling back to the API key', async () => {
    vi.stubEnv('ASSINAFY_API_KEY', API_KEY);
    list.mockRejectedValue(new Error('listConnections() failed: HTTP 500'));

    await expect(listBackgroundCredentials()).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
  });
});
