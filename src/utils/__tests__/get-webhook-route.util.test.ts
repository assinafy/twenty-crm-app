import { afterEach, describe, expect, it, vi } from 'vitest';

import { getWebhookRoute } from 'src/utils/get-webhook-route.util';

describe('getWebhookRoute', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('uses the functions URL Twenty sets for the workspace', () => {
    vi.stubEnv('TWENTY_FUNCTIONS_URL', 'https://acme.example.invalid/');
    vi.stubEnv('TWENTY_API_URL', 'https://api.example.invalid');
    expect(getWebhookRoute()).toBe('https://acme.example.invalid/assinafy/webhook');
  });

  it('falls back to the /s prefix of the API URL', () => {
    vi.stubEnv('TWENTY_FUNCTIONS_URL', '');
    vi.stubEnv('TWENTY_API_URL', 'https://twenty.example.invalid');
    expect(getWebhookRoute()).toBe('https://twenty.example.invalid/s/assinafy/webhook');
  });

  it('is null when the runtime gives no URL', () => {
    vi.stubEnv('TWENTY_FUNCTIONS_URL', undefined);
    vi.stubEnv('TWENTY_API_URL', undefined);
    expect(getWebhookRoute()).toBeNull();
  });
});
