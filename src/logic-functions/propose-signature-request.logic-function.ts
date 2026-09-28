import { defineLogicFunction } from 'twenty-sdk/define';
import { type LogicFunctionExecutionContext } from 'twenty-sdk/logic-function';

import { MAX_SIGNERS } from 'src/constants/limits';
import {
  PROPOSE_SIGNATURE_REQUEST_TOOL_UNIVERSAL_IDENTIFIER,
  SIGNATURE_REQUEST_TOOL_CALL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
import { proposeSignatureRequestHandler } from 'src/logic-functions/handlers/propose-signature-request.handler';
import { toMemberResult } from 'src/logic-functions/utils/to-member-result.util';
import { parseProposalInput } from 'src/utils/parse-proposal-input.util';

export default defineLogicFunction({
  universalIdentifier: PROPOSE_SIGNATURE_REQUEST_TOOL_UNIVERSAL_IDENTIFIER,
  name: 'propose-signature-request',
  description:
    'Prepara o rascunho de uma solicitação de assinatura eletrônica da Assinafy para um registro de Pessoa, Empresa ' +
    'ou Oportunidade. Esta ferramenta só prepara o rascunho: ela mostra ao usuário um cartão onde ele revisa o ' +
    'documento e os signatários, vê o custo informado pela Assinafy e faz o envio por conta própria. Chamá-la não ' +
    'carrega, não cobra e não envia nada, então nunca diga ao usuário que o documento foi enviado. Chame ' +
    'app_get_signature_context_tool antes e use apenas os ids de anexos, os ids de modelos e os ids de Pessoa que ' +
    'ela retornar. Os signatários precisam ser pessoas do CRM, indicadas pelos ids de Pessoa; os dados de contato vêm ' +
    'do CRM, então nunca invente nomes, e-mails ou telefones. Não informe preços: os custos vêm da Assinafy, no cartão.',
  timeoutSeconds: 60,
  toolTriggerSettings: {
    frontComponentUniversalIdentifier: SIGNATURE_REQUEST_TOOL_CALL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
    inputSchema: {
      type: 'object',
      properties: {
        recordId: { type: 'string', description: 'Id do registro de Pessoa, Empresa ou Oportunidade.' },
        sourceType: {
          type: 'string',
          enum: ['PDF', 'TEMPLATE'],
          description: 'PDF envia um PDF anexado ao registro; TEMPLATE envia um modelo da Assinafy.',
        },
        attachmentId: { type: 'string', description: 'Id de um PDF anexado retornado por app_get_signature_context_tool.' },
        templateId: { type: 'string', description: 'Id de um modelo retornado por app_get_signature_context_tool.' },
        signerPersonIds: {
          type: 'array',
          items: { type: 'string' },
          description: `Ids dos registros de Pessoa que vão assinar, no máximo ${MAX_SIGNERS}. Deixe vazio para o usuário escolher.`,
        },
        name: { type: 'string', description: 'Nome opcional do documento exibido aos signatários.' },
        message: { type: 'string', description: 'Mensagem opcional enviada aos signatários.' },
      },
      required: ['recordId'],
      additionalProperties: false,
    },
  },
  handler: (input: unknown, context: LogicFunctionExecutionContext) =>
    toMemberResult('propose-signature-request', context, (ctx) =>
      proposeSignatureRequestHandler(parseProposalInput(input), ctx),
    ),
});
