import { defineLogicFunction } from 'twenty-sdk/define';
import { type LogicFunctionExecutionContext, type RoutePayload } from 'twenty-sdk/logic-function';

import { REFRESH_DOCUMENT_ROUTE_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { refreshDocumentHandler } from 'src/logic-functions/handlers/refresh-document.handler';
import { toMemberResult } from 'src/logic-functions/utils/to-member-result.util';
import { parseDocumentActionInput } from 'src/utils/parse-document-action-input.util';

export default defineLogicFunction({
  universalIdentifier: REFRESH_DOCUMENT_ROUTE_UNIVERSAL_IDENTIFIER,
  name: 'refresh-assinafy-document',
  description: 'Lê na Assinafy o status mais recente de uma solicitação de assinatura e o armazena.',
  timeoutSeconds: 60,
  httpRouteTriggerSettings: { path: '/assinafy/documents/refresh', httpMethod: 'POST', isAuthRequired: true },
  handler: (event: RoutePayload, context: LogicFunctionExecutionContext) =>
    toMemberResult('refresh-document', context, (ctx) =>
      refreshDocumentHandler(parseDocumentActionInput(event.body), ctx),
    ),
});
