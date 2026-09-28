import { type CoreApiClient } from 'twenty-client-sdk/core';
import { type MetadataApiClient } from 'twenty-client-sdk/metadata';
import { vi } from 'vitest';

import { type CreateAssinafyClient } from 'src/types/create-assinafy-client';
import { type HandlerContext } from 'src/types/handler-context';

export const NOW = new Date('2026-09-25T12:00:00.000Z');

// Distinct opaque clients: data access is mocked, so tests only check which client each call used.
export const buildContext = (overrides: Partial<HandlerContext> = {}): HandlerContext => ({
  userCore: { name: 'userCore' } as unknown as CoreApiClient,
  appCore: { name: 'appCore' } as unknown as CoreApiClient,
  appMetadata: { name: 'appMetadata' } as unknown as MetadataApiClient,
  userWorkspaceId: 'member-1',
  now: () => NOW,
  createAssinafyClient: vi.fn<CreateAssinafyClient>(),
  ...overrides,
});
