import { defineLogicFunction, STANDARD_OBJECT } from 'twenty-sdk/define';
import { jsonSchemaToInputSchema, type LogicFunctionExecutionContext } from 'twenty-sdk/logic-function';

import { SEND_TIMEOUT_SECONDS } from 'src/constants/limits';
import { SEND_FOR_SIGNATURE_WORKFLOW_ACTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { sendForSignatureWorkflowHandler } from 'src/logic-functions/handlers/send-for-signature-workflow.handler';
import { buildHandlerContext } from 'src/logic-functions/utils/build-handler-context.util';

const record = (object: keyof typeof STANDARD_OBJECT, label: string) =>
  ({ type: 'record', objectUniversalIdentifier: STANDARD_OBJECT[object].universalIdentifier, label }) as const;

export default defineLogicFunction({
  universalIdentifier: SEND_FOR_SIGNATURE_WORKFLOW_ACTION_UNIVERSAL_IDENTIFIER,
  name: 'send-for-signature-workflow',
  description:
    'Envia um PDF anexado ou um modelo da Assinafy para assinatura eletrônica de pessoas do CRM, com a chave de API ' +
    'da Assinafy ou uma conexão compartilhada com o workspace. O documento é vinculado à oportunidade; na falta dela, ' +
    'à pessoa; e, na falta desta, à empresa. O PDF precisa estar anexado a esse registro. Interrompe o envio quando ' +
    'o custo na Assinafy ultrapassa o máximo de créditos (0 permite apenas envios cobertos pelos documentos do ' +
    'plano). Cada execução é um novo envio: deixe "Tentar novamente em caso de falha" desativado nesta ação. Se o ' +
    'mesmo documento foi enviado para o mesmo registro há poucos minutos, a ação retorna UNCERTAIN sem enviar de novo.',
  timeoutSeconds: SEND_TIMEOUT_SECONDS,
  workflowActionTriggerSettings: {
    label: 'Enviar para assinatura (Assinafy)',
    icon: 'IconSignature',
    inputSchema: jsonSchemaToInputSchema({
      type: 'object',
      properties: {
        attachment: record('attachment', 'PDF anexado'),
        templateId: { type: 'string', label: 'ID do modelo da Assinafy (em vez de um PDF)' },
        signers: {
          type: 'records',
          objectUniversalIdentifier: STANDARD_OBJECT.person.universalIdentifier,
          label: 'Signatários',
        },
        opportunity: record('opportunity', 'Oportunidade'),
        person: record('person', 'Pessoa'),
        company: record('company', 'Empresa'),
        name: { type: 'string', label: 'Nome do documento' },
        message: { type: 'string', label: 'Mensagem para os signatários', multiline: true },
        verificationMethod: { type: 'string', label: 'Validação da assinatura', enum: ['E-mail', 'WhatsApp'] },
        expiresInDays: { type: 'number', label: 'Prazo para assinar (dias)' },
        maxCredits: { type: 'number', label: 'Máximo de créditos (0 = somente documentos do plano)' },
      },
    }),
    outputSchema: jsonSchemaToInputSchema({
      type: 'object',
      properties: {
        ok: { type: 'boolean', label: 'Enviado' },
        documentRecordId: { type: 'string', label: 'ID do registro do Documento Assinafy' },
        status: { type: 'string', label: 'Status' },
        errorCode: { type: 'string', label: 'Código do erro' },
        errorMessage: { type: 'string', label: 'Mensagem de erro' },
      },
    }),
  },
  handler: (payload: unknown, context: LogicFunctionExecutionContext) =>
    sendForSignatureWorkflowHandler(payload, buildHandlerContext(context), context.retryCount),
});
