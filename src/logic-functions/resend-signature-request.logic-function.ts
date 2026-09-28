import { defineLogicFunction } from 'twenty-sdk/define';
import { type LogicFunctionExecutionContext, type RoutePayload } from 'twenty-sdk/logic-function';

import { RESEND_SIGNATURE_REQUEST_ROUTE_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { resendSignatureRequestHandler } from 'src/logic-functions/handlers/resend-signature-request.handler';
import { toMemberResult } from 'src/logic-functions/utils/to-member-result.util';
import { parseResendInput } from 'src/utils/parse-resend-input.util';

export default defineLogicFunction({
  universalIdentifier: RESEND_SIGNATURE_REQUEST_ROUTE_UNIVERSAL_IDENTIFIER,
  name: 'resend-assinafy-signature-request',
  description: 'Estima o custo e, em seguida, reenvia o convite de assinatura a um signatário que ainda não assinou.',
  timeoutSeconds: 60,
  httpRouteTriggerSettings: { path: '/assinafy/documents/resend', httpMethod: 'POST', isAuthRequired: true },
  handler: (event: RoutePayload, context: LogicFunctionExecutionContext) =>
    toMemberResult('resend-signature-request', context, (ctx) =>
      resendSignatureRequestHandler(parseResendInput(event.body), ctx),
    ),
});
