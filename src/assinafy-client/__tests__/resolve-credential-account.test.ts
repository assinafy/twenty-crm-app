import { ApiError, type AssinafyClient, type IWorkspaceListItem, NetworkError } from '@assinafy/sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LEAK_SENTINELS } from 'src/__tests__/setup/unit-test-setup';
import { reportCredentialFailure } from 'src/assinafy-client/report-credential-failure';
import { resolveCredentialAccount } from 'src/assinafy-client/resolve-credential-account';
import { type AssinafyCredential } from 'src/types/assinafy-credential';
import { type CreateAssinafyClient } from 'src/types/create-assinafy-client';

vi.mock('src/assinafy-client/report-credential-failure', () => ({
  reportCredentialFailure: vi.fn<typeof reportCredentialFailure>(),
}));

const report = vi.mocked(reportCredentialFailure);

const oauth: AssinafyCredential = {
  kind: 'personal',
  connectionId: 'connection-1',
  accessToken: LEAK_SENTINELS[0],
  scopes: ['documents:read'],
};
const apiKey = (configuredAccountId: string | null): AssinafyCredential => ({
  kind: 'apiKey',
  apiKey: LEAK_SENTINELS[1],
  configuredAccountId,
});

const account = (id: string): IWorkspaceListItem =>
  ({ id, name: `Workspace ${id}`, roles: [], is_delete_allowed: false }) as unknown as IWorkspaceListItem;

// Each created client is tagged with the options it was built with so the test can tell them apart.
const fakeFactory = (list: () => Promise<{ data: IWorkspaceListItem[] }>) =>
  vi.fn<CreateAssinafyClient>(
    (_credential, options) => ({ options, workspaces: { list } }) as unknown as AssinafyClient,
  );

const listing = (...ids: string[]) => fakeFactory(async () => ({ data: ids.map(account) }));

describe('resolveCredentialAccount', () => {
  beforeEach(() => {
    report.mockResolvedValue(undefined);
  });

  it('binds an OAuth credential to its only workspace with a new account-scoped client', async () => {
    const createClient = listing('acc-1');

    const resolved = await resolveCredentialAccount(oauth, createClient);

    expect(resolved).toMatchObject({ credential: oauth, accountId: 'acc-1', accountName: 'Workspace acc-1' });
    expect(createClient).toHaveBeenNthCalledWith(1, oauth, {});
    expect(createClient).toHaveBeenNthCalledWith(2, oauth, { accountId: 'acc-1' });
    expect(resolved.client).toBe(createClient.mock.results[1]?.value);
  });

  it('forwards timeout and retry options to both clients', async () => {
    const createClient = listing('acc-1');

    await resolveCredentialAccount(oauth, createClient, { timeoutMs: 5_000, maxRetries: 0 });

    expect(createClient).toHaveBeenNthCalledWith(1, oauth, { timeoutMs: 5_000, maxRetries: 0 });
    expect(createClient).toHaveBeenNthCalledWith(2, oauth, { timeoutMs: 5_000, maxRetries: 0, accountId: 'acc-1' });
  });

  it('asks for a reconnect, and flags the connection, when an OAuth grant lists no workspace', async () => {
    await expect(resolveCredentialAccount(oauth, listing())).rejects.toMatchObject({ code: 'RECONNECT_REQUIRED' });
    expect(report).toHaveBeenCalledExactlyOnceWith(oauth, expect.objectContaining({ code: 'RECONNECT_REQUIRED' }));
  });

  it('fails with INTERNAL, never ACCOUNT_REQUIRED, when an OAuth grant lists several workspaces', async () => {
    await expect(resolveCredentialAccount(oauth, listing('acc-1', 'acc-2'))).rejects.toMatchObject({
      code: 'INTERNAL',
    });
  });

  it('uses the configured account of an API key, named from the list', async () => {
    const resolved = await resolveCredentialAccount(apiKey('acc-2'), listing('acc-1', 'acc-2'));

    expect(resolved).toMatchObject({ accountId: 'acc-2', accountName: 'Workspace acc-2' });
  });

  it('fails with FORBIDDEN when the configured account is not reachable by the API key', async () => {
    await expect(resolveCredentialAccount(apiKey('acc-9'), listing('acc-1'))).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('uses the single workspace of an API key without a configured account', async () => {
    await expect(resolveCredentialAccount(apiKey(null), listing('acc-1'))).resolves.toMatchObject({
      accountId: 'acc-1',
    });
  });

  it('asks for ASSINAFY_ACCOUNT_ID when the API key reaches several workspaces', async () => {
    await expect(resolveCredentialAccount(apiKey(null), listing('acc-1', 'acc-2'))).rejects.toMatchObject({
      code: 'ACCOUNT_REQUIRED',
    });
  });

  it('fails with FORBIDDEN when the API key reaches no workspace', async () => {
    await expect(resolveCredentialAccount(apiKey(null), listing())).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('reports a rejected OAuth credential before rethrowing RECONNECT_REQUIRED', async () => {
    const createClient = fakeFactory(() => Promise.reject(new ApiError('Unauthorized', 401)));

    await expect(resolveCredentialAccount(oauth, createClient)).rejects.toMatchObject({ code: 'RECONNECT_REQUIRED' });
    expect(report).toHaveBeenCalledExactlyOnceWith(oauth, expect.objectContaining({ code: 'RECONNECT_REQUIRED' }));
  });

  it('reports a missing scope before rethrowing INSUFFICIENT_SCOPE', async () => {
    const error = new ApiError('Forbidden', 403);
    error.challenge = { scheme: 'Bearer', error: 'insufficient_scope', scope: 'account:read' };

    await expect(resolveCredentialAccount(oauth, fakeFactory(() => Promise.reject(error)))).rejects.toMatchObject({
      code: 'INSUFFICIENT_SCOPE',
      details: { scope: 'account:read' },
    });
    expect(report).toHaveBeenCalledWith(oauth, expect.objectContaining({ code: 'INSUFFICIENT_SCOPE' }));
  });

  it('maps outages as reads', async () => {
    const createClient = fakeFactory(() => Promise.reject(new NetworkError('timeout')));

    await expect(resolveCredentialAccount(apiKey(null), createClient)).rejects.toMatchObject({
      code: 'PROVIDER_UNAVAILABLE',
    });
  });

  it('maps a client construction failure', async () => {
    const createClient = vi.fn<CreateAssinafyClient>(() => {
      throw new TypeError('bad options');
    });

    await expect(resolveCredentialAccount(oauth, createClient)).rejects.toMatchObject({ code: 'INTERNAL' });
  });
});
