import { describe, expect, it, vi } from 'vitest';

import { buildContext } from 'src/__tests__/fixtures/build-context';
import { ASSINAFY_WEBHOOK_ROUTE_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import webhookRoute from 'src/logic-functions/assinafy-webhook.logic-function';
import { receiveAssinafyWebhookHandler } from 'src/logic-functions/handlers/receive-assinafy-webhook.handler';
import { buildHandlerContext } from 'src/logic-functions/utils/build-handler-context.util';

vi.mock('src/logic-functions/handlers/receive-assinafy-webhook.handler', () => ({ receiveAssinafyWebhookHandler: vi.fn<typeof receiveAssinafyWebhookHandler>() }));
vi.mock('src/logic-functions/utils/build-handler-context.util', () => ({ buildHandlerContext: vi.fn<typeof buildHandlerContext>() }));

const route = webhookRoute.config.handler as (event: unknown, context: unknown) => Promise<unknown>;
const context = { userWorkspaceId: null, workspaceId: 'ws-1', workspaceMemberId: null, retryCount: 0, maxRetries: 0 };

describe('assinafy-webhook logic function', () => {
  it('is a public POST route that forwards the Standard Webhooks headers', () => {
    expect(webhookRoute.success).toBe(true);
    expect(webhookRoute.config).toMatchObject({
      universalIdentifier: ASSINAFY_WEBHOOK_ROUTE_UNIVERSAL_IDENTIFIER,
      httpRouteTriggerSettings: {
        path: '/assinafy/webhook',
        httpMethod: 'POST',
        isAuthRequired: false,
        forwardedRequestHeaders: ['webhook-id', 'webhook-timestamp', 'webhook-signature'],
      },
    });
  });

  it.each([
    ['synced', 200],
    ['ignored', 200],
    ['failed', 200],
    ['unauthorized', 401],
  ] as const)('answers %s with HTTP %i', async (outcome, status) => {
    const ctx = buildContext({ userWorkspaceId: null });
    vi.mocked(buildHandlerContext).mockReturnValue(ctx);
    vi.mocked(receiveAssinafyWebhookHandler).mockResolvedValue(outcome);
    const event = { body: {} };

    await expect(route(event, context)).resolves.toMatchObject({ status, body: { outcome } });
    expect(receiveAssinafyWebhookHandler).toHaveBeenCalledWith(event, ctx);
    expect(buildHandlerContext).toHaveBeenCalledWith(context);
  });
});
