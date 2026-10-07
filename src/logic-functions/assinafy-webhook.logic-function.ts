import { defineLogicFunction } from 'twenty-sdk/define';
import { type LogicFunctionExecutionContext, Response, type RoutePayload } from 'twenty-sdk/logic-function';

import { WEBHOOK_ROUTE_PATH, WEBHOOK_SIGNATURE_HEADERS } from 'src/constants/assinafy';
import { ASSINAFY_WEBHOOK_ROUTE_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { receiveAssinafyWebhookHandler } from 'src/logic-functions/handlers/receive-assinafy-webhook.handler';
import { buildHandlerContext } from 'src/logic-functions/utils/build-handler-context.util';

export default defineLogicFunction({
  universalIdentifier: ASSINAFY_WEBHOOK_ROUTE_UNIVERSAL_IDENTIFIER,
  name: 'assinafy-webhook',
  description: 'Recebe os eventos da Assinafy e atualiza na hora o Documento Assinafy a que eles se referem.',
  timeoutSeconds: 60,
  // Assinafy calls without a Twenty session: the token in the URL (and the signature, when the endpoint is signed)
  // authenticates each delivery.
  httpRouteTriggerSettings: {
    path: WEBHOOK_ROUTE_PATH,
    httpMethod: 'POST',
    isAuthRequired: false,
    forwardedRequestHeaders: WEBHOOK_SIGNATURE_HEADERS,
  },
  handler: async (event: RoutePayload, context: LogicFunctionExecutionContext) => {
    const outcome = await receiveAssinafyWebhookHandler(event, buildHandlerContext(context));
    // Only a refused delivery is an error for Assinafy; a failed sync is retried by the periodic sync instead.
    return new Response({ outcome }, { status: outcome === 'unauthorized' ? 401 : 200 });
  },
});
