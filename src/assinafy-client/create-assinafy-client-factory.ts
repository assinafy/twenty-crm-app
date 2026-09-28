import { AssinafyClient } from '@assinafy/sdk';

import { type CreateAssinafyClient } from 'src/types/create-assinafy-client';

// GET /documents/{id} only; /documents/statuses shares the shape but is a catalog, not a document.
const DOCUMENT_DETAILS_PATH = /^\/documents\/(?!statuses$)[^/]+$/;

export const createAssinafyClientFactory =
  (baseUrl: string): CreateAssinafyClient =>
  (credential, options = {}) => {
    const client = new AssinafyClient({
      ...(credential.kind === 'apiKey' ? { apiKey: credential.apiKey } : { token: credential.accessToken }),
      accountId: options.accountId,
      baseUrl,
      // BILLABLE_CALL_BUDGET_MS (src/constants/limits.ts) is based on this default; change both together.
      timeout: options.timeoutMs ?? 30_000,
      maxRetries: options.maxRetries ?? 2,
    });

    // The API returns the assignment on document details only when asked, and the SDK never asks.
    client.getAxiosInstance().interceptors.request.use((config) => {
      if (config.method?.toLowerCase() === 'get' && DOCUMENT_DETAILS_PATH.test(config.url ?? '')) {
        config.params = { ...config.params, expand: 'assignment' };
      }
      return config;
    });

    return client;
  };
