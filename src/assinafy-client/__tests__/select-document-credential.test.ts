import { type AssinafyClient } from '@assinafy/sdk';
import { describe, expect, it, vi } from 'vitest';

import { LEAK_SENTINELS } from 'src/__tests__/setup/unit-test-setup';
import { listInteractiveCredentials } from 'src/assinafy-client/list-interactive-credentials';
import { resolveCredentialAccount } from 'src/assinafy-client/resolve-credential-account';
import { selectDocumentCredential } from 'src/assinafy-client/select-document-credential';
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
const createClient = vi.fn<CreateAssinafyClient>();

const credential = (connectionId: string): AssinafyCredential => ({
  kind: 'shared',
  connectionId,
  accessToken: LEAK_SENTINELS[0],
  scopes: [],
});
const [first, second, third] = [credential('c-1'), credential('c-2'), credential('c-3')] as const;

const resolvedTo = (accountId: string) => (candidate: AssinafyCredential): ResolvedCredential => ({
  credential: candidate,
  accountId,
  accountName: accountId,
  client: {} as AssinafyClient,
});

const select = (candidates: AssinafyCredential[]) => {
  list.mockResolvedValue(candidates);
  return selectDocumentCredential({ userWorkspaceId: 'member-1', createAssinafyClient: createClient }, 'acc-1');
};

describe('selectDocumentCredential', () => {
  it('fails with NOT_CONNECTED without candidates', async () => {
    await expect(select([])).rejects.toMatchObject({ code: 'NOT_CONNECTED' });
  });

  it('returns the first candidate bound to the document account and stops there', async () => {
    resolve.mockImplementationOnce(async (candidate) => resolvedTo('acc-other')(candidate));
    resolve.mockImplementationOnce(async (candidate) => resolvedTo('acc-1')(candidate));

    const resolved = await select([first, second, third]);

    expect(list).toHaveBeenCalledWith('member-1');
    expect(resolved.credential).toBe(second);
    expect(resolve).toHaveBeenCalledTimes(2);
    expect(resolve).toHaveBeenNthCalledWith(1, first, createClient);
    expect(resolve).toHaveBeenNthCalledWith(2, second, createClient);
  });

  it.each(['RECONNECT_REQUIRED', 'INSUFFICIENT_SCOPE', 'FORBIDDEN', 'ACCOUNT_REQUIRED'] as const)(
    'skips a candidate failing with %s',
    async (code) => {
      resolve.mockRejectedValueOnce(new AppFailure(code, 'skip'));
      resolve.mockImplementationOnce(async (candidate) => resolvedTo('acc-1')(candidate));

      await expect(select([first, second])).resolves.toMatchObject({
        credential: second,
      });
    },
  );

  it.each([
    ['an outage', new AppFailure('PROVIDER_UNAVAILABLE', 'down')],
    ['an unexpected error', new Error('boom')],
  ])('stops on %s', async (_label, error) => {
    resolve.mockRejectedValueOnce(error);

    await expect(select([first, second])).rejects.toBe(error);
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it('fails with FORBIDDEN naming the account when no candidate reaches it', async () => {
    resolve.mockRejectedValueOnce(new AppFailure('RECONNECT_REQUIRED', 'rejected'));
    resolve.mockImplementationOnce(async (candidate) => resolvedTo('acc-other')(candidate));

    await expect(select([first, second])).rejects.toMatchObject({
      code: 'FORBIDDEN',
      details: { accountId: 'acc-1' },
    });
  });

  it('fails with FORBIDDEN when candidates fail for reasons a reconnect does not fix', async () => {
    resolve.mockRejectedValueOnce(new AppFailure('RECONNECT_REQUIRED', 'rejected'));
    resolve.mockRejectedValueOnce(new AppFailure('ACCOUNT_REQUIRED', 'several'));

    await expect(select([first, second])).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('fails with RECONNECT_REQUIRED when every candidate needs a reconnect', async () => {
    resolve.mockRejectedValue(new AppFailure('RECONNECT_REQUIRED', 'rejected'));

    await expect(select([first, second])).rejects.toMatchObject({
      code: 'RECONNECT_REQUIRED',
    });
    expect(resolve).toHaveBeenCalledTimes(2);
  });

  it('treats a missing permission as needing a reconnect', async () => {
    resolve.mockRejectedValueOnce(new AppFailure('RECONNECT_REQUIRED', 'rejected'));
    resolve.mockRejectedValueOnce(new AppFailure('INSUFFICIENT_SCOPE', 'missing scope', { scope: 'templates:read' }));

    await expect(select([first, second])).rejects.toMatchObject({
      code: 'RECONNECT_REQUIRED',
    });
  });
});
