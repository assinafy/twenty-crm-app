import { defineLogicFunction } from 'twenty-sdk/define';
import { type LogicFunctionExecutionContext, type RoutePayload } from 'twenty-sdk/logic-function';

import { CANCEL_SIGNATURE_REQUEST_ROUTE_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { cancelSignatureRequestHandler } from 'src/logic-functions/handlers/cancel-signature-request.handler';
import { toMemberResult } from 'src/logic-functions/utils/to-member-result.util';
import { parseDocumentActionInput } from 'src/utils/parse-document-action-input.util';

export default defineLogicFunction({
  universalIdentifier: CANCEL_SIGNATURE_REQUEST_ROUTE_UNIVERSAL_IDENTIFIER,
  name: 'cancel-assinafy-signature-request',
  description: 'Cancela uma solicitação de assinatura que ainda está aguardando assinaturas.',
  timeoutSeconds: 60,
  httpRouteTriggerSettings: { path: '/assinafy/documents/cancel', httpMethod: 'POST', isAuthRequired: true },
  handler: (event: RoutePayload, context: LogicFunctionExecutionContext) =>
    toMemberResult('cancel-signature-request', context, (ctx) =>
      cancelSignatureRequestHandler(parseDocumentActionInput(event.body), ctx),
    ),
});
