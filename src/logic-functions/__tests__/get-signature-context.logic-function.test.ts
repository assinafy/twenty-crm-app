import { describe, expect, it, vi } from 'vitest';

import { MEMBER_EXECUTION_CONTEXT } from 'src/__tests__/fixtures/member-execution-context';
import { GET_SIGNATURE_CONTEXT_ROUTE_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import getSignatureContext from 'src/logic-functions/get-signature-context.logic-function';
import { getSignatureContextHandler } from 'src/logic-functions/handlers/get-signature-context.handler';
import { buildHandlerContext } from 'src/logic-functions/utils/build-handler-context.util';
import { type HandlerContext } from 'src/types/handler-context';
import { type SignatureContext } from 'src/types/signature-context';
import { AppFailure } from 'src/utils/app-failure.util';

vi.mock('src/logic-functions/handlers/get-signature-context.handler', () => ({
  getSignatureContextHandler: vi.fn<typeof getSignatureContextHandler>(),
}));
vi.mock('src/logic-functions/utils/build-handler-context.util', () => ({
  buildHandlerContext: vi.fn<typeof buildHandlerContext>(),
}));

const RECORD_ID = '0b8f5f7e-6d1c-4a55-9c43-1f5a3b2c9d10';
const route = getSignatureContext.config.handler as (event: unknown, context: unknown) => Promise<unknown>;
const ctx = { userWorkspaceId: 'member-1' } as HandlerContext;

describe('get-signature-context logic function', () => {
  it('is an authenticated POST route', () => {
    expect(getSignatureContext.success).toBe(true);
    expect(getSignatureContext.config).toMatchObject({
      universalIdentifier: GET_SIGNATURE_CONTEXT_ROUTE_UNIVERSAL_IDENTIFIER,
      timeoutSeconds: 60,
      httpRouteTriggerSettings: { path: '/assinafy/context', httpMethod: 'POST', isAuthRequired: true },
    });
  });

  it('answers the context of the record in an envelope', async () => {
    const context = { attachments: [] } as unknown as SignatureContext;
    vi.mocked(buildHandlerContext).mockReturnValue(ctx);
    vi.mocked(getSignatureContextHandler).mockResolvedValue(context);

    await expect(route({ body: { recordId: RECORD_ID } }, MEMBER_EXECUTION_CONTEXT)).resolves.toEqual({ ok: true, ...context });
    expect(buildHandlerContext).toHaveBeenCalledWith(MEMBER_EXECUTION_CONTEXT);
    expect(getSignatureContextHandler).toHaveBeenCalledWith({ recordId: RECORD_ID }, ctx);
  });

  it('answers FORBIDDEN to a call without a workspace member', async () => {
    vi.mocked(buildHandlerContext).mockReturnValue({ ...ctx, userWorkspaceId: null });

    await expect(route({ body: { recordId: RECORD_ID } }, MEMBER_EXECUTION_CONTEXT)).resolves.toMatchObject({
      ok: false,
      error: { code: 'FORBIDDEN' },
    });
    expect(getSignatureContextHandler).not.toHaveBeenCalled();
  });

  it('answers INVALID_INPUT and handler failures in the envelope', async () => {
    vi.mocked(buildHandlerContext).mockReturnValue(ctx);
    await expect(route({ body: { recordId: 'x' } }, MEMBER_EXECUTION_CONTEXT)).resolves.toMatchObject({
      error: { code: 'INVALID_INPUT' },
    });

    vi.mocked(getSignatureContextHandler).mockRejectedValue(new AppFailure('NOT_FOUND', 'Registro não encontrado.'));
    await expect(route({ body: { recordId: RECORD_ID } }, MEMBER_EXECUTION_CONTEXT)).resolves.toMatchObject({
      error: { code: 'NOT_FOUND' },
    });
  });
});
