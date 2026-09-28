import { type CoreApiClient } from 'twenty-client-sdk/core';
import { vi } from 'vitest';

// Hand-written CoreApiClient double: resolves every query/mutation with `result` and records the selection sent.
export const fakeCore = (result: unknown) => {
  const query = vi.fn<(request: object) => Promise<unknown>>().mockResolvedValue(result);
  const mutation = vi.fn<(request: object) => Promise<unknown>>().mockResolvedValue(result);

  return { core: { query, mutation } as unknown as CoreApiClient, query, mutation };
};
