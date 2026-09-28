import { type AssinafyClientOptions } from '@assinafy/sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LEAK_SENTINELS } from 'src/__tests__/setup/unit-test-setup';
import { revokeAssinafyGrant } from 'src/assinafy-client/revoke-assinafy-grant';
import { ASSINAFY_API_BASE_URL } from 'src/constants/assinafy';

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

const [accessToken, , clientSecret] = LEAK_SENTINELS;

describe('revokeAssinafyGrant', () => {
  beforeEach(() => {
    clientOptions.length = 0;
    vi.stubEnv('ASSINAFY_CLIENT_ID', ' client-1 ');
    vi.stubEnv('ASSINAFY_CLIENT_SECRET', clientSecret);
    revokeToken.mockResolvedValue(undefined);
  });

  it('revokes the access token with a credential-free client and the app OAuth client', async () => {
    await expect(revokeAssinafyGrant('uninstall', async () => accessToken)).resolves.toBeUndefined();

    expect(clientOptions).toEqual([
      { baseUrl: ASSINAFY_API_BASE_URL, timeout: 10_000, maxRetries: 0 } satisfies AssinafyClientOptions,
    ]);
    expect(revokeToken).toHaveBeenCalledExactlyOnceWith({
      token: accessToken,
      tokenTypeHint: 'access_token',
      clientId: 'client-1',
      clientSecret,
    });
  });

  it.each(['ASSINAFY_CLIENT_ID', 'ASSINAFY_CLIENT_SECRET'])(
    'reads no token when %s is not configured',
    async (variable) => {
      vi.stubEnv(variable, '  ');
      const readAccessToken = vi.fn<() => Promise<string>>();

      await revokeAssinafyGrant('uninstall', readAccessToken);

      expect(readAccessToken).not.toHaveBeenCalled();
      expect(revokeToken).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['the token cannot be read', async () => Promise.reject(new Error('not found'))],
    [
      'Assinafy refuses the revocation',
      async () => {
        revokeToken.mockRejectedValue(new Error(`invalid_client ${accessToken}`));
        return accessToken;
      },
    ],
  ])('never throws when %s, and logs the operation without the token', async (_label, readAccessToken) => {
    await expect(revokeAssinafyGrant('uninstall', readAccessToken)).resolves.toBeUndefined();

    expect(console.warn).toHaveBeenCalledWith('[assinafy] uninstall: revoke skipped', { name: 'Error' });
  });

  it('logs the type of a non-Error failure', async () => {
    revokeToken.mockRejectedValue('boom');

    await revokeAssinafyGrant('uninstall', async () => accessToken);

    expect(console.warn).toHaveBeenCalledWith(expect.any(String), { name: 'string' });
  });
});
