import { defineLogicFunction } from 'twenty-sdk/define';
import { type LogicFunctionExecutionContext, type RoutePayload } from 'twenty-sdk/logic-function';

import { MANAGE_CONTRACT_ROUTE_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { manageContractHandler } from 'src/logic-functions/handlers/manage-contract.handler';
import { toMemberResult } from 'src/logic-functions/utils/to-member-result.util';
import { parseContractInput } from 'src/utils/parse-contract-input.util';

export default defineLogicFunction({
  universalIdentifier: MANAGE_CONTRACT_ROUTE_UNIVERSAL_IDENTIFIER,
  name: 'manage-assinafy-contract',
  description: 'Consulta e gerencia os termos, a renovação e o encerramento do contrato vinculado ao documento.',
  timeoutSeconds: 120,
  httpRouteTriggerSettings: { path: '/assinafy/documents/contract', httpMethod: 'POST', isAuthRequired: true },
  handler: (event: RoutePayload, context: LogicFunctionExecutionContext) =>
    toMemberResult('manage-contract', context, (ctx) => manageContractHandler(parseContractInput(event.body), ctx)),
});
