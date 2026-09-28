import { describe, expect, it, vi } from 'vitest';

import { createAssinafyClient } from 'src/assinafy-client/create-assinafy-client';
import { buildHandlerContext } from 'src/logic-functions/utils/build-handler-context.util';

vi.mock('twenty-client-sdk/core', () => ({
  CoreApiClient: class {
    constructor(readonly options?: unknown) {}
  },
}));
vi.mock('twenty-client-sdk/metadata', () => ({
  MetadataApiClient: class {
    constructor(readonly options?: unknown) {}
  },
}));

const executionContext = {
  retryCount: 0,
  maxRetries: 0,
  workspaceId: 'workspace-1',
  userWorkspaceId: 'member-1',
  workspaceMemberId: 'workspace-member-1',
};

describe('buildHandlerContext', () => {
  it('acts as the person for userCore and as the application for appCore and appMetadata', () => {
    const ctx = buildHandlerContext(executionContext);

    expect(ctx.userCore).toMatchObject({ options: undefined });
    expect(ctx.appCore).toMatchObject({ options: { runAs: 'application' } });
    expect(ctx.appMetadata).toMatchObject({ options: { runAs: 'application' } });
    expect(ctx.userWorkspaceId).toBe('member-1');
    expect(ctx.createAssinafyClient).toBe(createAssinafyClient);
  });

  it('keeps a missing person as null', () => {
    expect(buildHandlerContext({ ...executionContext, userWorkspaceId: null }).userWorkspaceId).toBeNull();
  });

  it('reads the clock on every call', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const ctx = buildHandlerContext(executionContext);
    vi.setSystemTime(new Date('2026-01-02T00:00:00.000Z'));

    expect(ctx.now().toISOString()).toBe('2026-01-02T00:00:00.000Z');
    vi.useRealTimers();
  });
});
