import { type AssinafyClient } from '@assinafy/sdk';
import { describe, expect, it, vi } from 'vitest';

import { LEAK_SENTINELS } from 'src/__tests__/setup/unit-test-setup';
import { listInteractiveCredentials } from 'src/assinafy-client/list-interactive-credentials';
import { resolveCredentialAccount } from 'src/assinafy-client/resolve-credential-account';
import { selectSendCredential } from 'src/assinafy-client/select-send-credential';
import { NOT_CONNECTED_MESSAGE } from 'src/constants/not-connected-message';
import { type AssinafyCredential } from 'src/types/assinafy-credential';
import { type CreateAssinafyClient } from 'src/types/create-assinafy-client';
import { type ResolvedCredential } from 'src/types/resolved-credential';
import { AppFailure } from 'src/utils/app-failure.util';

vi.mock('src/assinafy-client/list-interactive-credentials', () => ({
  listInteractiveCredentials: vi.fn<typeof listInteractiveCredentials>(),
}));
vi.mock('src/assinafy-client/resolve-credential-account', () => ({
  resolveCredentialAccount: vi.fn<typeof resolveCredentialAccount>(),
}));

const list = vi.mocked(listInteractiveCredentials);
const resolve = vi.mocked(resolveCredentialAccount);

const createAssinafyClient = vi.fn<CreateAssinafyClient>();
const personal: AssinafyCredential = {
  kind: 'personal',
  connectionId: 'c-1',
  accessToken: LEAK_SENTINELS[0],
  scopes: [],
};
const apiKey: AssinafyCredential = { kind: 'apiKey', apiKey: LEAK_SENTINELS[1], configuredAccountId: null };

describe('selectSendCredential', () => {
  it('requires a workspace member', async () => {
    await expect(selectSendCredential({ userWorkspaceId: null, createAssinafyClient })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(list).not.toHaveBeenCalled();
  });

  it('fails with NOT_CONNECTED and reconnect guidance when no credential exists', async () => {
    list.mockResolvedValue([]);

    await expect(selectSendCredential({ userWorkspaceId: 'member-1', createAssinafyClient })).rejects.toMatchObject({
      code: 'NOT_CONNECTED',
      message: NOT_CONNECTED_MESSAGE,
    });
  });

  it('resolves the first interactive credential', async () => {
    const resolved: ResolvedCredential = {
      credential: personal,
      accountId: 'acc-1',
      accountName: 'Workspace',
      client: {} as AssinafyClient,
    };
    list.mockResolvedValue([personal, apiKey]);
    resolve.mockResolvedValue(resolved);

    await expect(selectSendCredential({ userWorkspaceId: 'member-1', createAssinafyClient })).resolves.toBe(resolved);
    expect(list).toHaveBeenCalledExactlyOnceWith('member-1');
    expect(resolve).toHaveBeenCalledExactlyOnceWith(personal, createAssinafyClient);
  });

  it('never falls through to the next credential when the first one fails', async () => {
    list.mockResolvedValue([personal, apiKey]);
    resolve.mockRejectedValue(new AppFailure('RECONNECT_REQUIRED', 'Rejected'));

    await expect(selectSendCredential({ userWorkspaceId: 'member-1', createAssinafyClient })).rejects.toMatchObject({
      code: 'RECONNECT_REQUIRED',
    });
    expect(resolve).toHaveBeenCalledTimes(1);
  });
});
