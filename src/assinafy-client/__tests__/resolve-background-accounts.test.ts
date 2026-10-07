import { describe, expect, it, vi } from 'vitest';

import { resolveBackgroundAccounts } from 'src/assinafy-client/resolve-background-accounts';
import { resolveCredentialAccount } from 'src/assinafy-client/resolve-credential-account';
import {
  apiKeyCredential,
  buildResolved,
  sharedCredential,
} from 'src/logic-functions/handlers/__tests__/document-handler-fixtures';
import { type CreateAssinafyClient } from 'src/types/create-assinafy-client';
import { AppFailure } from 'src/utils/app-failure.util';

vi.mock('src/assinafy-client/resolve-credential-account', () => ({ resolveCredentialAccount: vi.fn<typeof resolveCredentialAccount>() }));

describe('resolveBackgroundAccounts', () => {
  it('resolves each credential in order and skips, with a log line, one that fails', async () => {
    const createClient = vi.fn<CreateAssinafyClient>();
    const shared = buildResolved({}, 'acc-2', sharedCredential);
    vi.mocked(resolveCredentialAccount)
      .mockRejectedValueOnce(new AppFailure('RECONNECT_REQUIRED', 'Refused'))
      .mockResolvedValueOnce(shared);

    await expect(resolveBackgroundAccounts('cron', [apiKeyCredential, sharedCredential], createClient)).resolves.toEqual([
      shared,
    ]);
    expect(resolveCredentialAccount).toHaveBeenNthCalledWith(1, apiKeyCredential, createClient);
    expect(resolveCredentialAccount).toHaveBeenNthCalledWith(2, sharedCredential, createClient);
    expect(console.warn).toHaveBeenCalledWith('[assinafy] cron: credential skipped', { code: 'RECONNECT_REQUIRED' });
  });
});
