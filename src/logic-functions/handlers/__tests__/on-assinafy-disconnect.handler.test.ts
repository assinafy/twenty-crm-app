import { type AssinafyClientOptions } from '@assinafy/sdk';
import { AppConnectionAuthFailedError, getConnection, listConnections } from 'twenty-sdk/logic-function';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LEAK_SENTINELS } from 'src/__tests__/setup/unit-test-setup';
import { buildAppConnection } from 'src/assinafy-client/__tests__/build-app-connection';
import { ASSINAFY_API_BASE_URL } from 'src/constants/assinafy';
import { onAssinafyDisconnectHandler } from 'src/logic-functions/handlers/on-assinafy-disconnect.handler';

const { revokeToken, clientOptions } = vi.hoisted(() => ({
  revokeToken: vi.fn<(options: object) => Promise<void>>(),
  clientOptions: [] as unknown[],
}));

vi.mock('@assinafy/sdk', async () => ({
  ...(await vi.importActual<object>('@assinafy/sdk')),
  AssinafyClient: class {
    readonly oauth = { revokeToken };
    constructor(options: unknown) {
      clientOptions.push(options);
    }
  },
}));

vi.mock('twenty-sdk/logic-function', () => ({
  getConnection: vi.fn<typeof getConnection>(),
  listConnections: vi.fn<typeof listConnections>(),
  AppConnectionAuthFailedError: class extends Error {
    constructor(readonly connectionId: string) {
      super('auth failed');
      this.name = 'AppConnectionAuthFailedError';
    }
  },
}));

const fetchConnection = vi.mocked(getConnection);
const fetchConnections = vi.mocked(listConnections);
const [accessToken, , clientSecret] = LEAK_SENTINELS;
const payload = { connectionProviderId: 'provider-1', connectionProviderName: 'assinafy', connectedAccountId: 'c-1' };

describe('onAssinafyDisconnectHandler', () => {
  beforeEach(() => {
    clientOptions.length = 0;
    vi.stubEnv('ASSINAFY_CLIENT_ID', ' client-1 ');
    vi.stubEnv('ASSINAFY_CLIENT_SECRET', clientSecret);
    fetchConnection.mockResolvedValue(buildAppConnection({ id: 'c-1', accessToken }));
    revokeToken.mockResolvedValue(undefined);
  });

  it('revokes the access token with a credential-free client and the app OAuth client', async () => {
    await expect(onAssinafyDisconnectHandler(payload)).resolves.toBeUndefined();

    expect(fetchConnection).toHaveBeenCalledWith('c-1');
    expect(fetchConnections).not.toHaveBeenCalled();
    expect(clientOptions).toEqual([
      { baseUrl: ASSINAFY_API_BASE_URL, timeout: 10_000, maxRetries: 0 } satisfies AssinafyClientOptions,
    ]);
    expect(revokeToken).toHaveBeenCalledWith({
      token: accessToken,
      tokenTypeHint: 'access_token',
      clientId: 'client-1',
      clientSecret,
    });
  });

  it('revokes when Twenty runs the hook without a person', async () => {
    await onAssinafyDisconnectHandler(payload, { userWorkspaceId: null });

    expect(revokeToken).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ token: accessToken }));
  });

  it('ignores a run a member started, reading and revoking nothing', async () => {
    await expect(onAssinafyDisconnectHandler(payload, { userWorkspaceId: 'uw-1' })).resolves.toBeUndefined();

    expect(fetchConnection).not.toHaveBeenCalled();
    expect(fetchConnections).not.toHaveBeenCalled();
    expect(revokeToken).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith('[assinafy] on-assinafy-disconnect: member-triggered run ignored', {
      code: 'FORBIDDEN',
    });
  });

  it('revokes a connection the app flagged, with the token the connection list carries', async () => {
    fetchConnection.mockRejectedValue(new AppConnectionAuthFailedError('c-1'));
    fetchConnections.mockResolvedValue([
      buildAppConnection({ id: 'c-2', accessToken: 'other-token' }),
      buildAppConnection({ id: 'c-1', accessToken, authFailedAt: '2026-09-25T12:00:00.000Z' }),
    ]);

    await expect(onAssinafyDisconnectHandler(payload)).resolves.toBeUndefined();

    expect(fetchConnections).toHaveBeenCalledWith({ providerName: 'assinafy' });
    expect(revokeToken).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ token: accessToken }));
  });

  it.each([
    ['the client id', 'ASSINAFY_CLIENT_ID'],
    ['the client secret', 'ASSINAFY_CLIENT_SECRET'],
  ])('skips when %s is not configured', async (_label, variable) => {
    vi.stubEnv(variable, '  ');

    await onAssinafyDisconnectHandler(payload);

    expect(fetchConnection).not.toHaveBeenCalled();
    expect(revokeToken).not.toHaveBeenCalled();
  });

  it.each([
    ['the connection cannot be read', () => fetchConnection.mockRejectedValue(new Error('not found'))],
    [
      'a flagged connection is missing from the list',
      () => {
        fetchConnection.mockRejectedValue(new AppConnectionAuthFailedError('c-1'));
        fetchConnections.mockResolvedValue([buildAppConnection({ id: 'c-2' })]);
      },
    ],
    [
      'the connections cannot be listed',
      () => {
        fetchConnection.mockRejectedValue(new AppConnectionAuthFailedError('c-1'));
        fetchConnections.mockRejectedValue(new Error('listConnections() failed'));
      },
    ],
    ['Assinafy refuses the revocation', () => revokeToken.mockRejectedValue(new Error(`invalid_client ${accessToken}`))],
  ])('never throws when %s, and logs no token', async (_label, arrange) => {
    arrange();

    await expect(onAssinafyDisconnectHandler(payload)).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith('[assinafy] on-assinafy-disconnect: revoke skipped', {
      name: expect.any(String),
    });
  });

  it('lists connections only for a connection the app flagged', async () => {
    fetchConnection.mockRejectedValue(new Error('Connection c-1 could not be refreshed; ask the user to reconnect'));

    await onAssinafyDisconnectHandler(payload);

    expect(fetchConnections).not.toHaveBeenCalled();
    expect(revokeToken).not.toHaveBeenCalled();
  });

  it('logs the type of a non-Error failure', async () => {
    revokeToken.mockRejectedValue('boom');

    await onAssinafyDisconnectHandler(payload);

    expect(console.warn).toHaveBeenCalledWith(expect.any(String), { name: 'string' });
  });
});
