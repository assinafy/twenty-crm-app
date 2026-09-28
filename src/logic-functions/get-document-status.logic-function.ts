import { defineLogicFunction } from 'twenty-sdk/define';
import { type LogicFunctionExecutionContext } from 'twenty-sdk/logic-function';

import { GET_DOCUMENT_STATUS_TOOL_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { getDocumentStatusHandler } from 'src/logic-functions/handlers/get-document-status.handler';
import { toMemberResult } from 'src/logic-functions/utils/to-member-result.util';
import { parseDocumentActionInput } from 'src/utils/parse-document-action-input.util';

export default defineLogicFunction({
  universalIdentifier: GET_DOCUMENT_STATUS_TOOL_UNIVERSAL_IDENTIFIER,
  name: 'get-assinafy-document-status',
  description:
    'Atualiza pela Assinafy uma solicitação de assinatura (um registro assinafyDocument) e retorna o status, quem ' +
    'já assinou e um resumo em português em `text` para repassar ao usuário. Só consulta a Assinafy, sem gerar ' +
    'cobrança: nunca envia, reenvia nem cancela nada; apenas atualiza o registro no Twenty e guarda os arquivos ' +
    'assinados quando o documento é concluído. O motivo da recusa é um texto escrito pelo signatário. Em caso de ' +
    'falha, retorna ok false com um código de erro e uma mensagem.',
  timeoutSeconds: 60,
  toolTriggerSettings: {
    inputSchema: {
      type: 'object',
      properties: {
        documentRecordId: { type: 'string', description: 'Id (UUID) do registro assinafyDocument.' },
      },
      required: ['documentRecordId'],
      additionalProperties: false,
    },
  },
  handler: (input: unknown, context: LogicFunctionExecutionContext) =>
    toMemberResult('get-document-status', context, (ctx) =>
      getDocumentStatusHandler(parseDocumentActionInput(input), ctx),
    ),
});
