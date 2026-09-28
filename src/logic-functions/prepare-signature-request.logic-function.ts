import { defineLogicFunction } from 'twenty-sdk/define';
import { type LogicFunctionExecutionContext, type RoutePayload } from 'twenty-sdk/logic-function';

import { SEND_TIMEOUT_SECONDS } from 'src/constants/limits';
import { PREPARE_SIGNATURE_REQUEST_ROUTE_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { toMemberResult } from 'src/logic-functions/utils/to-member-result.util';
import { prepareSignatureRequest } from 'src/services/prepare-signature-request.service';
import { parseSignatureRequestInput } from 'src/utils/parse-signature-request-input.util';

export default defineLogicFunction({
  universalIdentifier: PREPARE_SIGNATURE_REQUEST_ROUTE_UNIVERSAL_IDENTIFIER,
  name: 'prepare-signature-request',
  description: 'Carrega o PDF ou confere o modelo e retorna a estimativa de custo da Assinafy. Não envia nada.',
  // Credential check, download, upload and estimate run one after another, each bounded at 30 s.
  timeoutSeconds: SEND_TIMEOUT_SECONDS,
  httpRouteTriggerSettings: { path: '/assinafy/prepare', httpMethod: 'POST', isAuthRequired: true },
  handler: (event: RoutePayload, context: LogicFunctionExecutionContext) =>
    toMemberResult('prepare-signature-request', context, (ctx) =>
      prepareSignatureRequest(ctx, parseSignatureRequestInput(event.body, ctx.now())),
    ),
});
