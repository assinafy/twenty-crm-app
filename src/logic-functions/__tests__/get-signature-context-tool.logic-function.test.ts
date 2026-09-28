import { describe, expect, it, vi } from 'vitest';

import { MEMBER_EXECUTION_CONTEXT } from 'src/__tests__/fixtures/member-execution-context';
import { GET_SIGNATURE_CONTEXT_TOOL_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import getSignatureContextTool from 'src/logic-functions/get-signature-context-tool.logic-function';
import { getSignatureContextHandler } from 'src/logic-functions/handlers/get-signature-context.handler';
import { buildHandlerContext } from 'src/logic-functions/utils/build-handler-context.util';
import { type HandlerContext } from 'src/types/handler-context';
import { type SignatureContext } from 'src/types/signature-context';

vi.mock('src/logic-functions/handlers/get-signature-context.handler', () => ({
  getSignatureContextHandler: vi.fn<typeof getSignatureContextHandler>(),
}));
vi.mock('src/logic-functions/utils/build-handler-context.util', () => ({
  buildHandlerContext: vi.fn<typeof buildHandlerContext>(),
}));

const RECORD_ID = '0b8f5f7e-6d1c-4a55-9c43-1f5a3b2c9d10';
const tool = getSignatureContextTool.config.handler as (input: unknown, context: unknown) => Promise<unknown>;
const ctx = { userWorkspaceId: 'member-1' } as HandlerContext;

describe('get-signature-context tool', () => {
  it('is an AI tool that tells the model to use only CRM data', () => {
    expect(getSignatureContextTool.success).toBe(true);
    expect(getSignatureContextTool.config).toMatchObject({
      universalIdentifier: GET_SIGNATURE_CONTEXT_TOOL_UNIVERSAL_IDENTIFIER,
      timeoutSeconds: 60,
      toolTriggerSettings: { inputSchema: { required: ['recordId'], additionalProperties: false } },
    });
    expect(getSignatureContextTool.config.description).toMatch(/nunca invente/);
    expect(getSignatureContextTool.config.description).toMatch(/recentSends lista os documentos/);
    expect(getSignatureContextTool.config.httpRouteTriggerSettings).toBeUndefined();
  });

  it('answers the context for the tool input', async () => {
    const context = { templates: [] } as unknown as SignatureContext;
    vi.mocked(buildHandlerContext).mockReturnValue(ctx);
    vi.mocked(getSignatureContextHandler).mockResolvedValue(context);

    await expect(tool({ recordId: RECORD_ID }, MEMBER_EXECUTION_CONTEXT)).resolves.toEqual({ ok: true, ...context });
    expect(getSignatureContextHandler).toHaveBeenCalledWith({ recordId: RECORD_ID }, ctx);
  });

  it('refuses callers without a workspace member', async () => {
    vi.mocked(buildHandlerContext).mockReturnValue({ ...ctx, userWorkspaceId: null });

    await expect(tool({ recordId: RECORD_ID }, MEMBER_EXECUTION_CONTEXT)).resolves.toMatchObject({
      ok: false,
      error: { code: 'FORBIDDEN' },
    });
    expect(getSignatureContextHandler).not.toHaveBeenCalled();
  });
});
