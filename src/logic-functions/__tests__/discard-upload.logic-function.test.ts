import { describe, expect, it, vi } from 'vitest';

import { MEMBER_EXECUTION_CONTEXT } from 'src/__tests__/fixtures/member-execution-context';
import { DISCARD_UPLOAD_ROUTE_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import discardUpload from 'src/logic-functions/discard-upload.logic-function';
import { discardUploadHandler } from 'src/logic-functions/handlers/discard-upload.handler';
import { buildHandlerContext } from 'src/logic-functions/utils/build-handler-context.util';
import { type HandlerContext } from 'src/types/handler-context';

vi.mock('src/logic-functions/handlers/discard-upload.handler', () => ({
  discardUploadHandler: vi.fn<typeof discardUploadHandler>(),
}));
vi.mock('src/logic-functions/utils/build-handler-context.util', () => ({
  buildHandlerContext: vi.fn<typeof buildHandlerContext>(),
}));

const route = discardUpload.config.handler as (event: unknown, context: unknown) => Promise<unknown>;
const ctx = { userWorkspaceId: 'member-1' } as HandlerContext;
const body = { assinafyDocumentId: 'doc-1', accountId: 'acc-1' };

describe('discard-upload logic function', () => {
  it('is an authenticated POST route', () => {
    expect(discardUpload.success).toBe(true);
    expect(discardUpload.config).toMatchObject({
      universalIdentifier: DISCARD_UPLOAD_ROUTE_UNIVERSAL_IDENTIFIER,
      timeoutSeconds: 60,
      httpRouteTriggerSettings: { path: '/assinafy/discard', httpMethod: 'POST', isAuthRequired: true },
    });
  });

  it('discards the upload', async () => {
    vi.mocked(buildHandlerContext).mockReturnValue(ctx);
    vi.mocked(discardUploadHandler).mockResolvedValue({});

    await expect(route({ body }, MEMBER_EXECUTION_CONTEXT)).resolves.toEqual({ ok: true });
    expect(discardUploadHandler).toHaveBeenCalledWith(body, ctx);
  });

  it('answers FORBIDDEN without a workspace member and INVALID_INPUT for a bad body', async () => {
    vi.mocked(buildHandlerContext).mockReturnValue({ ...ctx, userWorkspaceId: null });
    await expect(route({ body }, MEMBER_EXECUTION_CONTEXT)).resolves.toMatchObject({ error: { code: 'FORBIDDEN' } });

    vi.mocked(buildHandlerContext).mockReturnValue(ctx);
    await expect(route({ body: { ...body, accountId: '../x' } }, MEMBER_EXECUTION_CONTEXT)).resolves.toMatchObject({
      error: { code: 'INVALID_INPUT' },
    });
    expect(discardUploadHandler).not.toHaveBeenCalled();
  });
});
