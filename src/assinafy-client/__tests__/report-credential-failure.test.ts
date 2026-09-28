import { reportConnectionAuthFailure } from 'twenty-sdk/logic-function';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LEAK_SENTINELS } from 'src/__tests__/setup/unit-test-setup';
import { reportCredentialFailure } from 'src/assinafy-client/report-credential-failure';
import { type AssinafyCredential } from 'src/types/assinafy-credential';
import { AppFailure } from 'src/utils/app-failure.util';

vi.mock('twenty-sdk/logic-function', () => ({
  reportConnectionAuthFailure: vi.fn<typeof reportConnectionAuthFailure>(),
}));

const report = vi.mocked(reportConnectionAuthFailure);

const oauth = (scopes: string[] = ['documents:read']): AssinafyCredential => ({
  kind: 'personal',
  connectionId: 'connection-1',
  accessToken: LEAK_SENTINELS[0],
  scopes,
});

const scopeFailure = (scope: unknown): AppFailure =>
  new AppFailure('INSUFFICIENT_SCOPE', 'Missing permission', { scope });

describe('reportCredentialFailure', () => {
  beforeEach(() => {
    report.mockResolvedValue(undefined);
  });

  it('reports RECONNECT_REQUIRED on an OAuth credential', async () => {
    await reportCredentialFailure(oauth(), new AppFailure('RECONNECT_REQUIRED', 'Rejected'));

    expect(report).toHaveBeenCalledExactlyOnceWith({
      connectionId: 'connection-1',
      reason: 'A Assinafy recusou a conexão. Reconecte para continuar.',
    });
  });

  it('never reports an API key credential', async () => {
    const apiKey: AssinafyCredential = { kind: 'apiKey', apiKey: LEAK_SENTINELS[1], configuredAccountId: null };
    await reportCredentialFailure(apiKey, new AppFailure('RECONNECT_REQUIRED', 'Rejected'));
    expect(report).not.toHaveBeenCalled();
  });

  it('ignores codes a reconnect cannot fix', async () => {
    await reportCredentialFailure(oauth(), new AppFailure('FORBIDDEN', 'Denied'));
    expect(report).not.toHaveBeenCalled();
  });

  it('reports a manifest scope the connection lacks', async () => {
    await reportCredentialFailure(oauth(['documents:read']), scopeFailure('templates:write'));

    expect(report).toHaveBeenCalledExactlyOnceWith({
      connectionId: 'connection-1',
      reason: 'Reconecte a Assinafy e conceda a permissão templates:write.',
    });
  });

  it('names only the missing manifest scopes of a multi-scope challenge', async () => {
    await reportCredentialFailure(oauth(['documents:read']), scopeFailure('documents:read documents:write billing'));

    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'Reconecte a Assinafy e conceda a permissão documents:write.' }),
    );
  });

  it('names several missing manifest scopes in the plural', async () => {
    await reportCredentialFailure(oauth(['documents:read']), scopeFailure('documents:write templates:read'));

    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'Reconecte a Assinafy e conceda as permissões documents:write templates:read.' }),
    );
  });

  it.each([
    ['a scope the connection already has', 'documents:read'],
    ['a scope outside the manifest', 'billing:write'],
    ['no scope', null],
  ])('does not report %s', async (_label, scope) => {
    await reportCredentialFailure(oauth(['documents:read']), scopeFailure(scope));
    expect(report).not.toHaveBeenCalled();
  });

  it('does not report INSUFFICIENT_SCOPE without details', async () => {
    await reportCredentialFailure(oauth(), new AppFailure('INSUFFICIENT_SCOPE', 'Missing permission'));
    expect(report).not.toHaveBeenCalled();
  });

  it('swallows report failures and logs only the error name', async () => {
    report.mockRejectedValue(new Error(`boom ${LEAK_SENTINELS[0]}`));

    await expect(
      reportCredentialFailure(oauth(), new AppFailure('RECONNECT_REQUIRED', 'Rejected')),
    ).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith('[assinafy] reportConnectionAuthFailure failed', { name: 'Error' });
  });

  it('logs the type of a non-Error rejection', async () => {
    report.mockRejectedValue('offline');

    await reportCredentialFailure(oauth(), new AppFailure('RECONNECT_REQUIRED', 'Rejected'));
    expect(console.warn).toHaveBeenCalledWith('[assinafy] reportConnectionAuthFailure failed', { name: 'string' });
  });
});
