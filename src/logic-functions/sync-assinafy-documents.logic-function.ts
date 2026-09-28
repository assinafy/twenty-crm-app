import { defineLogicFunction } from 'twenty-sdk/define';
import { type CronPayload, type LogicFunctionExecutionContext } from 'twenty-sdk/logic-function';

import { SYNC_TIMEOUT_SECONDS } from 'src/constants/limits';
import { SYNC_DOCUMENTS_CRON_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { syncAssinafyDocumentsHandler } from 'src/logic-functions/handlers/sync-assinafy-documents.handler';
import { buildHandlerContext } from 'src/logic-functions/utils/build-handler-context.util';

export default defineLogicFunction({
  universalIdentifier: SYNC_DOCUMENTS_CRON_UNIVERSAL_IDENTIFIER,
  name: 'sync-assinafy-documents',
  description: 'A cada 15 minutos, atualiza pela Assinafy as solicitações de assinatura em aberto e armazena os arquivos assinados.',
  timeoutSeconds: SYNC_TIMEOUT_SECONDS,
  cronTriggerSettings: { pattern: '*/15 * * * *' },
  handler: (_payload: CronPayload, context: LogicFunctionExecutionContext) =>
    syncAssinafyDocumentsHandler(buildHandlerContext(context)),
});
