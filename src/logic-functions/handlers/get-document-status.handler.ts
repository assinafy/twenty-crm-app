import { refreshDocumentHandler } from 'src/logic-functions/handlers/refresh-document.handler';
import { type DocumentStatus } from 'src/types/document-status';
import { type DocumentSummary } from 'src/types/document-summary';
import { type MemberHandlerContext } from 'src/types/member-handler-context';
import { type SignerState } from 'src/types/signer-state';
import { type StoredSigner } from 'src/types/stored-signer';
import { formatDate } from 'src/utils/format-date.util';
import { getSignerState } from 'src/utils/get-signer-state.util';

const STATUS_TEXT: Record<DocumentStatus, string> = {
  SENDING: 'está sendo enviado para a Assinafy',
  PENDING_SIGNATURE: 'está aguardando assinaturas',
  CERTIFICATING: 'foi assinado e a Assinafy está finalizando o arquivo assinado',
  CERTIFICATED: 'foi assinado',
  REJECTED_BY_SIGNER: 'foi recusado por um signatário',
  CANCELLED: 'foi cancelado',
  EXPIRED: 'expirou antes de todos os signatários assinarem',
  FAILED: 'não pôde ser enviado',
  UNCERTAIN: 'pode não ter sido enviado; confira na Assinafy antes de enviar novamente',
  UNKNOWN: 'está com um status que o app não reconhece; confira na Assinafy',
};

// The agent relays the text to members in Brazil, whatever the server's time zone.
const inBrasilia = (iso: string | null): string | null => {
  const date = formatDate(iso, 'America/Sao_Paulo');
  return date === null ? null : `${date} (horário de Brasília)`;
};

// Same states as the document panel shows.
const SIGNER_STATE_TEXT: Record<SignerState, string> = {
  SIGNED: 'assinou',
  DECLINED: 'recusou',
  DELIVERY_FAILED: 'falha na entrega',
  NOT_SIGNED: 'não assinou',
  INVITED: 'convidado, ainda não assinou',
  WAITING: 'aguardando signatários anteriores',
  NOT_INVITED: 'ainda não convidado',
};

const describeSigner = (signer: StoredSigner, status: DocumentStatus): string =>
  `${signer.name} (${SIGNER_STATE_TEXT[getSignerState(signer, status)]})`;

const describeDocument = (document: DocumentSummary): string => {
  const sentAt = inBrasilia(document.sentAt);
  const expiresAt = inBrasilia(document.expiresAt);
  const completedAt = inBrasilia(document.completedAt);
  const lastSyncedAt = inBrasilia(document.lastSyncedAt);

  return [
    `${document.name === null ? 'O documento sem nome' : `O documento "${document.name}"`} ${STATUS_TEXT[document.status]}.`,
    `Assinaturas: ${document.signedCount} de ${document.signerCount}.`,
    document.signers.length > 0
      ? `Signatários: ${document.signers.map((signer) => describeSigner(signer, document.status)).join(', ')}.`
      : null,
    document.declineReason ? `Motivo da recusa: "${document.declineReason}".` : null,
    document.lastError ? `Código do último erro: ${document.lastError}.` : null,
    sentAt ? `Enviado em ${sentAt}.` : null,
    expiresAt ? `Prazo para assinar: ${expiresAt}.` : null,
    completedAt ? `Concluído em ${completedAt}.` : null,
    lastSyncedAt ? `Última verificação: ${lastSyncedAt}.` : null,
  ]
    .filter((line) => line !== null)
    .join(' ');
};

// AI tool: refreshes like the document panel does and adds a pt-BR summary for the agent to relay.
export const getDocumentStatusHandler = async (
  input: { documentRecordId: string },
  ctx: MemberHandlerContext,
): Promise<{ document: DocumentSummary; text: string }> => {
  const document = await refreshDocumentHandler(input, ctx);

  return { document, text: describeDocument(document) };
};
