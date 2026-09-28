import { msg, type MessageDescriptor } from 'twenty-sdk/front-component';

import { MAX_EDITOR_FIELD_VALUE_LENGTH, MAX_MESSAGE_LENGTH, MAX_NAME_LENGTH, MAX_SIGNERS } from 'src/constants/limits';
import { NOT_CONNECTED_MESSAGE } from 'src/constants/not-connected-message';
import { type AppErrorCode } from 'src/types/app-error-code';
import { type LocalizedMessage } from 'src/types/localized-message';

const ERROR_MESSAGES: Record<AppErrorCode, MessageDescriptor> = {
  INVALID_INPUT: msg('Há informações ausentes ou inválidas na solicitação.'),
  NOT_CONNECTED: msg(NOT_CONNECTED_MESSAGE),
  RECONNECT_REQUIRED: msg('A Assinafy recusou as credenciais. Reconecte a Assinafy em Configurações → Aplicativos → Assinafy ou atualize a chave de API lá.'),
  INSUFFICIENT_SCOPE: msg('Reconecte a Assinafy e conceda todas as permissões solicitadas.'),
  FORBIDDEN: msg('Sua conexão com a Assinafy não tem acesso a este documento ou workspace.'),
  ACCOUNT_REQUIRED: msg(
    'A chave de API acessa vários workspaces da Assinafy. Peça a um administrador para informar o ID do workspace da Assinafy.',
  ),
  NOT_FOUND: msg('Este registro ou arquivo não está mais disponível.'),
  RATE_LIMITED: msg('A Assinafy está recebendo muitas solicitações. Aguarde um momento e tente novamente.'),
  PROVIDER_REJECTED: msg('A Assinafy recusou o documento ou os dados dos signatários.'),
  PROVIDER_UNAVAILABLE: msg('A Assinafy está indisponível no momento. Tente novamente em alguns minutos.'),
  UNCERTAIN: msg('Confira o envio na Assinafy: a solicitação pode ter sido recebida. Verifique o documento na Assinafy antes de enviá-lo novamente.'),
  COST_CHANGED: msg('O custo mudou desde a sua revisão. Confira a nova estimativa e confirme novamente.'),
  INSUFFICIENT_RESOURCES: msg('O saldo do workspace da Assinafy não é suficiente para esta solicitação.'),
  COST_LIMIT_EXCEEDED: msg('O custo ultrapassa o limite de créditos permitido.'),
  INVALID_STATE: msg('Este documento mudou nesse meio-tempo. Revise-o novamente.'),
  INTERNAL: msg('Algo deu errado. Tente novamente.'),
};

const BLOCKING_MESSAGES: Record<string, MessageDescriptor> = {
  PendingPayment: msg(
    'O workspace da Assinafy tem um pagamento pendente. Regularize-o na Assinafy e revise novamente.',
  ),
  InsufficientDocuments: msg(
    'O plano do workspace da Assinafy não tem mais documentos disponíveis. Adicione documentos na Assinafy e revise novamente.',
  ),
  InsufficientCredits: msg(
    'O workspace da Assinafy não tem créditos suficientes. Adicione créditos na Assinafy e revise novamente.',
  ),
};

const UNSUPPORTED_TEMPLATE = msg(
  'Este modelo tem papéis além de signatários e editores, por isso não pode ser enviado pelo Twenty.',
);

// MAX_SIGNERS and MAX_EDITOR_FIELDS.
const TOO_LARGE_TEMPLATE = msg(
  'Este modelo tem mais de 20 papéis de signatário ou mais de 50 campos para preencher, por isso não pode ser enviado pelo Twenty.',
);

// The server checks the draft against the live template; the form was built from the templates listed when it opened.
const TEMPLATE_CHANGED = msg(
  'O modelo foi alterado na Assinafy depois que você abriu o envio. Feche e abra o envio de novo para usar a versão atual.',
);

// Keyed by `field:reason`, then by field, as reported in INVALID_INPUT details by the shared validators and by the
// AI proposal tool (bare `attachmentId`, `templateId` and `signerPersonIds` fields).
const INPUT_MESSAGES: Record<string, MessageDescriptor> = {
  'name:required': msg('Informe o nome do documento.'),
  name: msg('O nome do documento é longo demais (até {max} caracteres).'),
  message: msg('A mensagem é longa demais (até {max} caracteres).'),
  // SEND_MIN_EXPIRATION_MINUTES.
  'expiresAt:too_soon': msg('Escolha um prazo de pelo menos 65 minutos a partir de agora.'),
  expiresAt: msg('Informe um prazo válido.'),
  'source.attachmentId:FILE_TOO_LARGE': msg(
    'Este PDF tem mais de 25 MB, o limite da Assinafy. Volte ao documento e escolha um arquivo menor.',
  ),
  'source.attachmentId:NOT_A_PDF': msg('Este anexo não é um PDF válido. Volte ao documento e escolha outro arquivo.'),
  'source.attachmentId:UNSUPPORTED_URL': msg(
    'Não foi possível baixar este anexo do Twenty. Volte ao documento e escolha outro arquivo.',
  ),
  'source.attachmentId': msg('Escolha um PDF anexado a este registro.'),
  'source.templateId:unsupported': UNSUPPORTED_TEMPLATE,
  'source.templateId:too_large': TOO_LARGE_TEMPLATE,
  'source.templateId:not_found': TEMPLATE_CHANGED,
  'source.editorFields.fieldId:unknown': TEMPLATE_CHANGED,
  'source.editorFields.value:missing': TEMPLATE_CHANGED,
  'source.templateId': msg('Escolha um modelo da Assinafy.'),
  'source.editorFields.value': msg('Preencha todos os campos do modelo (até {max} caracteres cada).'),
  'signers:too_many': msg('Adicione no máximo {max} signatários.'),
  signers: msg('Inclua pelo menos um signatário.'),
  'signers.name:required': msg('Informe o nome do signatário {number}.'),
  'signers.name': msg('Signatário {number}: o nome é longo demais.'),
  'signers.email:required': msg('Informe o e-mail do signatário {number}.'),
  'signers.email:duplicate': msg('Signatário {number}: este e-mail já é usado por outro signatário.'),
  'signers.email': msg('Signatário {number}: informe um e-mail válido.'),
  'signers.phone:required': msg('Informe o WhatsApp do signatário {number}.'),
  'signers.phone:duplicate': msg('Signatário {number}: este WhatsApp já é usado por outro signatário.'),
  'signers.phone': msg('Signatário {number}: informe o WhatsApp com + e o código do país (de 8 a 15 dígitos).'),
  'signers.governmentId': msg(
    'Signatário {number}: informe o CPF (11 dígitos) ou o CNPJ (14 dígitos) do titular do certificado.',
  ),
  'signers.roleId:mismatch': TEMPLATE_CHANGED,
  'signers.roleId': msg('Cada papel do modelo precisa de um signatário diferente.'),
  'attachmentId:not_found': msg(
    'O assistente indicou um anexo que não está neste registro. Peça para ele tentar novamente.',
  ),
  'templateId:not_found': msg(
    'O assistente indicou um modelo que não existe neste workspace da Assinafy. Peça para ele tentar novamente.',
  ),
  'templateId:unsupported': UNSUPPORTED_TEMPLATE,
  'templateId:too_large': TOO_LARGE_TEMPLATE,
  'signerPersonIds:not_found': msg(
    'O assistente indicou uma pessoa que não foi encontrada no Twenty. Peça para ele tentar novamente.',
  ),
};

const MAX_BY_FIELD: Record<string, number> = {
  name: MAX_NAME_LENGTH,
  message: MAX_MESSAGE_LENGTH,
  signers: MAX_SIGNERS,
  'source.editorFields.value': MAX_EDITOR_FIELD_VALUE_LENGTH,
};

const describeInvalidInput = (details: Record<string, unknown>): LocalizedMessage => {
  const field = String(details.field ?? '');
  const message = INPUT_MESSAGES[`${field}:${String(details.reason)}`] ?? INPUT_MESSAGES[field];

  if (message === undefined) {
    return { message: ERROR_MESSAGES.INVALID_INPUT };
  }

  return {
    message,
    values: {
      number: typeof details.index === 'number' ? details.index + 1 : 1,
      max: MAX_BY_FIELD[field] ?? 0,
    },
  };
};

// Translates an app error (or a stored lastError code) into a message; unknown codes read as INTERNAL.
export const getErrorMessage = (error: {
  code: string;
  message?: string;
  details?: Record<string, unknown>;
}): LocalizedMessage => {
  const details = error.details ?? {};

  switch (error.code) {
    case 'INVALID_INPUT':
      return describeInvalidInput(details);
    case 'PROVIDER_REJECTED':
      if (!error.message) {
        return { message: ERROR_MESSAGES.PROVIDER_REJECTED };
      }

      // Only Assinafy's own (sanitized) text gets the prefix; the app's pt-BR guidance is shown as written.
      return details.providerMessage === true
        ? { message: msg('A Assinafy recusou a solicitação: {reason}'), values: { reason: error.message } }
        : { message: msg('{reason}'), values: { reason: error.message } };
    case 'INSUFFICIENT_SCOPE':
      return typeof details.scope === 'string'
        ? { message: msg('Reconecte a Assinafy e conceda a permissão {scope}.'), values: { scope: details.scope } }
        : { message: ERROR_MESSAGES.INSUFFICIENT_SCOPE };
    case 'FORBIDDEN':
      if (details.reason === 'member_create_permission') {
        return {
          message: msg(
            'Sua função no Twenty não permite criar Documentos Assinafy. Peça a um administrador para liberar a edição desse objeto.',
          ),
        };
      }

      return details.reason === 'member_permission'
        ? { message: msg('Sua função no Twenty não permite alterar este documento.') }
        : { message: ERROR_MESSAGES.FORBIDDEN };
    // Twenty itself (listing connections, downloading an attachment) failed, not Assinafy.
    case 'PROVIDER_UNAVAILABLE':
      return details.provider === 'twenty'
        ? { message: msg('O Twenty não respondeu. Tente novamente em instantes.') }
        : { message: ERROR_MESSAGES.PROVIDER_UNAVAILABLE };
    // Stored by the sync on a FAILED record when the unconfirmed send never reached the signers; a send retried with
    // the same request id answers with that record.
    case 'NOT_SENT':
      return { message: msg('A Assinafy confirmou que a tentativa anterior não foi enviada. Confirme e envie novamente.') };
    case 'INSUFFICIENT_RESOURCES':
      return { message: BLOCKING_MESSAGES[String(details.blockingReason)] ?? ERROR_MESSAGES.INSUFFICIENT_RESOURCES };
    default:
      return { message: ERROR_MESSAGES[error.code as AppErrorCode] ?? ERROR_MESSAGES.INTERNAL };
  }
};
