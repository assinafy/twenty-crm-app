import { kv } from 'twenty-sdk/logic-function';

import { KV_WEBHOOK_ENDPOINTS } from 'src/constants/kv-keys';
import { type WebhookEndpoint } from 'src/types/webhook-endpoint';

const toWebhookEndpoint = (value: unknown): WebhookEndpoint[] => {
  const entry = value as Partial<WebhookEndpoint> | null;
  if (
    typeof entry !== 'object' ||
    entry === null ||
    typeof entry.accountId !== 'string' ||
    typeof entry.endpointId !== 'string' ||
    typeof entry.url !== 'string' ||
    typeof entry.email !== 'string' ||
    typeof entry.token !== 'string' ||
    (entry.secret !== null && typeof entry.secret !== 'string')
  ) {
    return [];
  }
  const { accountId, endpointId, url, email, token, secret } = entry;
  return [{ accountId, endpointId, url, email, token, secret }];
};

// The webhook endpoints the app registered, one per Assinafy workspace. Malformed entries are dropped.
export const readWebhookEndpoints = async (): Promise<WebhookEndpoint[]> => {
  const stored = await kv.get<unknown>(KV_WEBHOOK_ENDPOINTS);
  return Array.isArray(stored) ? stored.flatMap(toWebhookEndpoint) : [];
};
