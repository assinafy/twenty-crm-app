import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildAppConnection } from 'src/assinafy-client/__tests__/build-app-connection';
import { listAssinafyConnections } from 'src/assinafy-client/list-assinafy-connections';
import { readApiKeyCredential } from 'src/assinafy-client/read-api-key-credential';
import { resolveBackgroundAccounts } from 'src/assinafy-client/resolve-background-accounts';
import { revokeAssinafyGrant } from 'src/assinafy-client/revoke-assinafy-grant';
import { apiKeyCredential, buildResolved } from 'src/logic-functions/handlers/__tests__/document-handler-fixtures';
import { uninstallHandler } from 'src/logic-functions/handlers/uninstall.handler';
import { reconcileWebhookEndpoints } from 'src/services/reconcile-webhook-endpoints.service';
import { type CreateAssinafyClient } from 'src/types/create-assinafy-client';
import { AppFailure } from 'src/utils/app-failure.util';

vi.mock('src/assinafy-client/list-assinafy-connections', () => ({ listAssinafyConnections: vi.fn<typeof listAssinafyConnections>() }));
vi.mock('src/assinafy-client/revoke-assinafy-grant', () => ({ revokeAssinafyGrant: vi.fn<typeof revokeAssinafyGrant>() }));
vi.mock('src/assinafy-client/read-api-key-credential', () => ({ readApiKeyCredential: vi.fn<typeof readApiKeyCredential>() }));
vi.mock('src/assinafy-client/resolve-background-accounts', () => ({ resolveBackgroundAccounts: vi.fn<typeof resolveBackgroundAccounts>() }));
vi.mock('src/services/reconcile-webhook-endpoints.service', () => ({ reconcileWebhookEndpoints: vi.fn<typeof reconcileWebhookEndpoints>() }));

const listConnections = vi.mocked(listAssinafyConnections);
const revoke = vi.mocked(revokeAssinafyGrant);
const resolveAccounts = vi.mocked(resolveBackgroundAccounts);
const reconcile = vi.mocked(reconcileWebhookEndpoints);
const createClient = vi.fn<CreateAssinafyClient>();

describe('uninstallHandler', () => {
  beforeEach(() => {
    vi.mocked(readApiKeyCredential).mockReturnValue(null);
    resolveAccounts.mockResolvedValue([]);
    reconcile.mockResolvedValue(undefined);
  });

  it('removes the webhook endpoints with the API key and every connection before revoking the tokens', async () => {
    const order: string[] = [];
    vi.mocked(readApiKeyCredential).mockReturnValue(apiKeyCredential);
    listConnections.mockResolvedValue([buildAppConnection({ id: 'c-1', visibility: 'workspace', accessToken: 'token-1' })]);
    const resolved = [buildResolved({}, 'acc-1', apiKeyCredential)];
    resolveAccounts.mockResolvedValue(resolved);
    reconcile.mockImplementation(async () => {
      order.push('webhooks');
    });
    revoke.mockImplementation(async () => {
      order.push('revoke');
    });

    await uninstallHandler({}, undefined, createClient);

    expect(resolveAccounts).toHaveBeenCalledExactlyOnceWith(
      'uninstall',
      [apiKeyCredential, expect.objectContaining({ kind: 'shared', connectionId: 'c-1', accessToken: 'token-1' })],
      createClient,
    );
    expect(reconcile).toHaveBeenCalledExactlyOnceWith(resolved, null);
    expect(order).toEqual(['webhooks', 'revoke']);
  });

  it('still revokes the tokens when the webhook endpoints cannot be removed', async () => {
    listConnections.mockResolvedValue([buildAppConnection({ accessToken: 'token-1' })]);
    reconcile.mockRejectedValue(new AppFailure('PROVIDER_UNAVAILABLE', 'Down'));
    revoke.mockResolvedValue(undefined);

    await expect(uninstallHandler()).resolves.toBeUndefined();

    expect(revoke).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith('[assinafy] uninstall: webhook endpoints not removed', {
      code: 'PROVIDER_UNAVAILABLE',
    });
  });

  it('revokes every listed connection, personal, shared and flagged, with the token the listing resolved', async () => {
    listConnections.mockResolvedValue([
      buildAppConnection({ id: 'c-1', visibility: 'user', accessToken: 'token-1' }),
      buildAppConnection({ id: 'c-2', visibility: 'workspace', accessToken: 'token-2' }),
      buildAppConnection({ id: 'c-3', accessToken: 'token-3', authFailedAt: '2026-09-25T12:00:00.000Z' }),
    ]);
    revoke.mockResolvedValue(undefined);

    await expect(uninstallHandler()).resolves.toBeUndefined();

    expect(listConnections).toHaveBeenCalledExactlyOnceWith({});
    expect(revoke.mock.calls.map(([operation]) => operation)).toEqual(['uninstall', 'uninstall', 'uninstall']);
    await expect(Promise.all(revoke.mock.calls.map(([, readAccessToken]) => readAccessToken()))).resolves.toEqual([
      'token-1',
      'token-2',
      'token-3',
    ]);
  });

  it.each([
    ['without a person', { userWorkspaceId: null }],
    ['without a context', undefined],
  ])('revokes when Twenty runs the hook %s', async (_label, context) => {
    listConnections.mockResolvedValue([buildAppConnection({ accessToken: 'token-1' })]);
    revoke.mockResolvedValue(undefined);

    await uninstallHandler({}, context);

    expect(revoke).toHaveBeenCalledTimes(1);
  });

  it('ignores a run a member started, revoking nothing', async () => {
    listConnections.mockResolvedValue([buildAppConnection({ accessToken: 'token-1' })]);

    await expect(uninstallHandler({}, { userWorkspaceId: 'uw-1' })).resolves.toBeUndefined();

    expect(listConnections).not.toHaveBeenCalled();
    expect(revoke).not.toHaveBeenCalled();
    expect(reconcile).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith('[assinafy] uninstall: member-triggered run ignored', {
      code: 'FORBIDDEN',
    });
  });

  it('never throws when the connections cannot be listed', async () => {
    listConnections.mockRejectedValue(new AppFailure('PROVIDER_UNAVAILABLE', 'Down'));

    await expect(uninstallHandler()).resolves.toBeUndefined();
    expect(revoke).not.toHaveBeenCalled();
  });
});
