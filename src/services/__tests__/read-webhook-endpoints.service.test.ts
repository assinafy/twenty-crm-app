import { beforeEach, describe, expect, it, vi } from 'vitest';

const { store, kv } = await vi.hoisted(async () => (await import('src/services/__tests__/kv-store')).createKvStore());

vi.mock('twenty-sdk/logic-function', () => ({ kv }));

import { KV_WEBHOOK_ENDPOINTS } from 'src/constants/kv-keys';
import { readWebhookEndpoints } from 'src/services/read-webhook-endpoints.service';

const entry = {
  accountId: 'acc-1',
  endpointId: 'ep-1',
  url: 'https://twenty.example.invalid/s/assinafy/webhook?token=t',
  email: 'ops@example.invalid',
  token: 't',
  secret: 'whsec_c2VjcmV0',
};

describe('readWebhookEndpoints', () => {
  beforeEach(() => store.clear());

  it('reads nothing when the key is unset or not a list', async () => {
    await expect(readWebhookEndpoints()).resolves.toEqual([]);
    store.set(KV_WEBHOOK_ENDPOINTS, entry);
    await expect(readWebhookEndpoints()).resolves.toEqual([]);
  });

  it('keeps well-formed entries, signed or not, and drops the others', async () => {
    const unsigned = { ...entry, accountId: 'acc-2', secret: null };
    store.set(KV_WEBHOOK_ENDPOINTS, [
      entry,
      unsigned,
      null,
      'ep-3',
      { ...entry, token: 42 },
      { ...entry, secret: 42 },
      { ...entry, secret: undefined },
      { ...entry, url: undefined },
      { ...entry, email: null },
      { ...entry, endpointId: 7 },
      { ...entry, accountId: null },
    ]);

    await expect(readWebhookEndpoints()).resolves.toEqual([entry, unsigned]);
    expect(kv.get).toHaveBeenCalledWith(KV_WEBHOOK_ENDPOINTS);
  });
});
