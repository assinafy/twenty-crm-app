import { afterEach, describe, expect, it, vi } from 'vitest';

import { ASSINAFY_WEBHOOK_EMAIL_VARIABLE } from 'src/constants/assinafy';
import { readWebhookEmail } from 'src/utils/read-webhook-email.util';

describe('readWebhookEmail', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('reads the trimmed contact email', () => {
    vi.stubEnv(ASSINAFY_WEBHOOK_EMAIL_VARIABLE, '  ops@example.invalid ');
    expect(readWebhookEmail()).toBe('ops@example.invalid');
  });

  it.each([undefined, '', '   ', 'not-an-email'])('turns webhooks off for %o', (value) => {
    vi.stubEnv(ASSINAFY_WEBHOOK_EMAIL_VARIABLE, value);
    expect(readWebhookEmail()).toBeNull();
  });
});
