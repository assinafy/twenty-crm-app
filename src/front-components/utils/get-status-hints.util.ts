import { msg } from 'twenty-sdk/front-component';

import { getErrorMessage } from 'src/front-components/utils/get-error-message.util';
import { type AssinafyDocumentRecord } from 'src/types/assinafy-document-record';
import { type LocalizedMessage } from 'src/types/localized-message';

// Explains what the status means for the user and what to do next.
export const getStatusHints = (
  record: Pick<AssinafyDocumentRecord, 'status' | 'lastError' | 'declineReason' | 'assinafyDocumentId'>,
): LocalizedMessage[] => {
  const { status, lastError, declineReason } = record;

  switch (status) {
    case 'SENDING':
      return [{ message: msg('Enviando para a Assinafy. Atualize em instantes.') }];
    case 'UNCERTAIN':
      return [
        {
          message:
            record.assinafyDocumentId === null
              ? msg(
                  'A Assinafy pode ter criado este documento. Confira na Assinafy; se ele não estiver lá, remova-o do Twenty e envie novamente.',
                )
              : msg('A Assinafy pode ter recebido esta solicitação. Atualize para conferir.'),
        },
      ];
    case 'FAILED':
      return [
        { message: msg('Esta solicitação não chegou aos signatários. Remova-a e envie novamente.') },
        ...(lastError && lastError !== 'NOT_SENT' ? [getErrorMessage({ code: lastError })] : []),
      ];
    case 'REJECTED_BY_SIGNER':
      return declineReason ? [{ message: msg('Motivo informado: {reason}'), values: { reason: declineReason } }] : [];
    case 'EXPIRED':
      return [
        { message: msg('O prazo para assinar terminou. Prorrogue-o na Assinafy para coletar as assinaturas que faltam.') },
      ];
    case 'CANCELLED':
      return lastError === 'NOT_FOUND' ? [{ message: msg('Este documento foi excluído na Assinafy.') }] : [];
    default:
      if (lastError === 'SIGNED_FILES_PENDING') {
        return [
          {
            message: msg('Todos assinaram. O PDF assinado ainda está sendo copiado para o Twenty; atualize em alguns minutos.'),
          },
        ];
      }

      // Stored by the background sync when no shared connection or API key reaches the document's workspace.
      if (lastError === 'NO_CREDENTIAL') {
        return [
          {
            message: msg(
              'As atualizações automáticas não alcançam o workspace da Assinafy deste documento. Peça a um administrador para compartilhar uma conexão com esse workspace ou configurar uma chave de API com acesso a ele.',
            ),
          },
        ];
      }

      // Code of the last failed refresh while the status is open; a successful refresh clears it.
      return lastError ? [getErrorMessage({ code: lastError })] : [];
  }
};
