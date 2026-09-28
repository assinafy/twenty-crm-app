import { defineLogicFunction } from 'twenty-sdk/define';
import { type LogicFunctionExecutionContext, type RoutePayload } from 'twenty-sdk/logic-function';

import { DISCARD_UPLOAD_ROUTE_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { discardUploadHandler } from 'src/logic-functions/handlers/discard-upload.handler';
import { toMemberResult } from 'src/logic-functions/utils/to-member-result.util';
import { parseDiscardInput } from 'src/utils/parse-discard-input.util';

export default defineLogicFunction({
  universalIdentifier: DISCARD_UPLOAD_ROUTE_UNIVERSAL_IDENTIFIER,
  name: 'discard-upload',
  description: 'Exclui um PDF que o fluxo de envio carregou na Assinafy, mas nunca enviou.',
  timeoutSeconds: 60,
  httpRouteTriggerSettings: { path: '/assinafy/discard', httpMethod: 'POST', isAuthRequired: true },
  handler: (event: RoutePayload, context: LogicFunctionExecutionContext) =>
    toMemberResult('discard-upload', context, (ctx) =>
      discardUploadHandler(parseDiscardInput(event.body), ctx),
    ),
});
