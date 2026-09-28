import { describe, expect, it, vi } from 'vitest';

import { LEAK_SENTINELS } from 'src/__tests__/setup/unit-test-setup';
import { readApiKeyCredential } from 'src/assinafy-client/read-api-key-credential';

const API_KEY = LEAK_SENTINELS[1];

describe('readApiKeyCredential', () => {
  it('returns null when no API key is set', () => {
    vi.stubEnv('ASSINAFY_API_KEY', undefined);
    expect(readApiKeyCredential()).toBeNull();
  });

  it('returns null for a blank API key', () => {
    vi.stubEnv('ASSINAFY_API_KEY', '   ');
    vi.stubEnv('ASSINAFY_ACCOUNT_ID', 'acc-1');
    expect(readApiKeyCredential()).toBeNull();
  });

  it('returns the trimmed key and account id', () => {
    vi.stubEnv('ASSINAFY_API_KEY', ` ${API_KEY} `);
    vi.stubEnv('ASSINAFY_ACCOUNT_ID', ' acc-1 ');
    expect(readApiKeyCredential()).toEqual({ kind: 'apiKey', apiKey: API_KEY, configuredAccountId: 'acc-1' });
  });

  it.each([undefined, '', '  '])('treats account id %j as not configured', (accountId) => {
    vi.stubEnv('ASSINAFY_API_KEY', API_KEY);
    vi.stubEnv('ASSINAFY_ACCOUNT_ID', accountId);
    expect(readApiKeyCredential()).toEqual({ kind: 'apiKey', apiKey: API_KEY, configuredAccountId: null });
  });
});
