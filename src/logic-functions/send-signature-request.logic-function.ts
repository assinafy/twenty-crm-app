import { defineLogicFunction } from 'twenty-sdk/define';
import { type LogicFunctionExecutionContext, type RoutePayload } from 'twenty-sdk/logic-function';

import { SEND_TIMEOUT_SECONDS } from 'src/constants/limits';
import { SEND_SIGNATURE_REQUEST_ROUTE_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { toMemberResult } from 'src/logic-functions/utils/to-member-result.util';
import { sendSignatureRequest } from 'src/services/send-signature-request.service';
import { getSendDeadline } from 'src/utils/get-send-deadline.util';
import { parseSendSignatureRequestInput } from 'src/utils/parse-send-signature-request-input.util';

export default defineLogicFunction({
  universalIdentifier: SEND_SIGNATURE_REQUEST_ROUTE_UNIVERSAL_IDENTIFIER,
  name: 'send-signature-request',
  description: 'Envia uma única vez uma solicitação de assinatura revisada, depois de conferir o custo da Assinafy que o usuário confirmou.',
  timeoutSeconds: SEND_TIMEOUT_SECONDS,
  httpRouteTriggerSettings: { path: '/assinafy/send', httpMethod: 'POST', isAuthRequired: true },
  handler: (event: RoutePayload, context: LogicFunctionExecutionContext) =>
    toMemberResult('send-signature-request', context, (ctx) =>
      sendSignatureRequest(ctx, {
        ...parseSendSignatureRequestInput(event.body, ctx.now()),
        deadlineMs: getSendDeadline(ctx.now()),
      }),
    ),
});
