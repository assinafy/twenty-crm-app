import { type LogicFunctionExecutionContext } from 'twenty-sdk/logic-function';
import { describe, expect, it, vi } from 'vitest';

import { buildContext } from 'src/__tests__/fixtures/build-context';
import { SYNC_TIMEOUT_SECONDS } from 'src/constants/limits';
import { SYNC_DOCUMENTS_CRON_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { syncAssinafyDocumentsHandler } from 'src/logic-functions/handlers/sync-assinafy-documents.handler';
import syncAssinafyDocuments from 'src/logic-functions/sync-assinafy-documents.logic-function';
import { buildHandlerContext } from 'src/logic-functions/utils/build-handler-context.util';

vi.mock('src/logic-functions/handlers/sync-assinafy-documents.handler', () => ({
  syncAssinafyDocumentsHandler: vi.fn<typeof syncAssinafyDocumentsHandler>(),
}));
vi.mock('src/logic-functions/utils/build-handler-context.util', () => ({ buildHandlerContext: vi.fn<typeof buildHandlerContext>() }));

const handler = vi.mocked(syncAssinafyDocumentsHandler);
const build = vi.mocked(buildHandlerContext);
const cron = syncAssinafyDocuments.config.handler as (payload: unknown, context: unknown) => Promise<unknown>;

describe('sync-assinafy-documents logic function', () => {
  it('runs every 15 minutes with the sync timeout', () => {
    expect(syncAssinafyDocuments.success).toBe(true);
    expect(syncAssinafyDocuments.config).toMatchObject({
      universalIdentifier: SYNC_DOCUMENTS_CRON_UNIVERSAL_IDENTIFIER,
      timeoutSeconds: SYNC_TIMEOUT_SECONDS,
      cronTriggerSettings: { pattern: '*/15 * * * *' },
    });
  });

  it('runs the handler with a context built from the execution context', async () => {
    const executionContext: LogicFunctionExecutionContext = {
      retryCount: 0,
      maxRetries: 0,
      workspaceId: 'workspace-1',
      userWorkspaceId: null,
      workspaceMemberId: null,
    };
    const ctx = buildContext({ userWorkspaceId: null });
    const counts = { found: 1, synced: 1, failed: 0, skipped: 0, purged: 0 };
    build.mockReturnValue(ctx);
    handler.mockResolvedValue(counts);

    await expect(cron({}, executionContext)).resolves.toEqual(counts);
    expect(build).toHaveBeenCalledWith(executionContext);
    expect(handler).toHaveBeenCalledWith(ctx);
  });
});
