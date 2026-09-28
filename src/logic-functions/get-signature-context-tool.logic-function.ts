import { defineLogicFunction } from 'twenty-sdk/define';
import { type LogicFunctionExecutionContext } from 'twenty-sdk/logic-function';

import { GET_SIGNATURE_CONTEXT_TOOL_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { getSignatureContextHandler } from 'src/logic-functions/handlers/get-signature-context.handler';
import { toMemberResult } from 'src/logic-functions/utils/to-member-result.util';
import { parseRecordIdInput } from 'src/utils/parse-record-id-input.util';

export default defineLogicFunction({
  universalIdentifier: GET_SIGNATURE_CONTEXT_TOOL_UNIVERSAL_IDENTIFIER,
  name: 'get-signature-context-tool',
  description:
    'Consulta o que pode ser enviado para assinatura eletrônica com a Assinafy a partir de um registro de Pessoa, ' +
    'Empresa ou Oportunidade: os PDFs anexados, os modelos prontos da Assinafy, os signatários sugeridos e outros ' +
    'contatos do CRM, e o workspace da Assinafy que faria o envio (sendingAs é null quando a Assinafy não está ' +
    'conectada). recentSends lista os documentos criados a partir do registro na última hora que podem ter chegado ' +
    'aos signatários; avise o usuário sobre eles antes de propor um novo envio. Chame esta ferramenta antes de ' +
    'app_propose_signature_request e use apenas os ids de anexos, os ids de modelos e as pessoas que ela retornar. ' +
    'Os signatários só podem ser pessoas do CRM: nunca invente nomes, e-mails ou telefones. Esta ferramenta apenas ' +
    'lê dados e não envia nada.',
  timeoutSeconds: 60,
  toolTriggerSettings: {
    inputSchema: {
      type: 'object',
      properties: {
        recordId: { type: 'string', description: 'Id do registro de Pessoa, Empresa ou Oportunidade.' },
      },
      required: ['recordId'],
      additionalProperties: false,
    },
  },
  handler: (input: unknown, context: LogicFunctionExecutionContext) =>
    toMemberResult('get-signature-context', context, (ctx) =>
      getSignatureContextHandler(parseRecordIdInput(input), ctx),
    ),
});
