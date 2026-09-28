import { defineLogicFunction } from 'twenty-sdk/define';
import { type LogicFunctionExecutionContext, type RoutePayload } from 'twenty-sdk/logic-function';

import { GET_SIGNATURE_CONTEXT_ROUTE_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { getSignatureContextHandler } from 'src/logic-functions/handlers/get-signature-context.handler';
import { toMemberResult } from 'src/logic-functions/utils/to-member-result.util';
import { parseRecordIdInput } from 'src/utils/parse-record-id-input.util';

export default defineLogicFunction({
  universalIdentifier: GET_SIGNATURE_CONTEXT_ROUTE_UNIVERSAL_IDENTIFIER,
  name: 'get-signature-context',
  description: 'Carrega os anexos, modelos e contatos que o fluxo de envio para assinatura oferece para um registro.',
  timeoutSeconds: 60,
  httpRouteTriggerSettings: { path: '/assinafy/context', httpMethod: 'POST', isAuthRequired: true },
  handler: (event: RoutePayload, context: LogicFunctionExecutionContext) =>
    toMemberResult('get-signature-context', context, (ctx) =>
      getSignatureContextHandler(parseRecordIdInput(event.body), ctx),
    ),
});
