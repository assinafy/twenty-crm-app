import { type ThemeColor } from 'twenty-ui/theme';

import { DOCUMENT_STATUS } from 'src/constants/document-status';
import { type DocumentStatus } from 'src/types/document-status';

// Options of the status field; the front components' status tags use the same labels and colors.
export const DOCUMENT_STATUS_OPTIONS: Array<{
  value: DocumentStatus;
  label: string;
  position: number;
  color: ThemeColor;
}> = [
  { value: DOCUMENT_STATUS.SENDING, label: 'Enviando', position: 0, color: 'gray' },
  { value: DOCUMENT_STATUS.PENDING_SIGNATURE, label: 'Aguardando assinaturas', position: 1, color: 'blue' },
  { value: DOCUMENT_STATUS.CERTIFICATING, label: 'Finalizando', position: 2, color: 'sky' },
  { value: DOCUMENT_STATUS.CERTIFICATED, label: 'Assinado', position: 3, color: 'green' },
  { value: DOCUMENT_STATUS.REJECTED_BY_SIGNER, label: 'Recusado', position: 4, color: 'red' },
  { value: DOCUMENT_STATUS.CANCELLED, label: 'Cancelado', position: 5, color: 'gray' },
  { value: DOCUMENT_STATUS.EXPIRED, label: 'Expirado', position: 6, color: 'orange' },
  { value: DOCUMENT_STATUS.FAILED, label: 'Falhou', position: 7, color: 'red' },
  { value: DOCUMENT_STATUS.UNCERTAIN, label: 'Confira na Assinafy', position: 8, color: 'amber' },
  { value: DOCUMENT_STATUS.UNKNOWN, label: 'Desconhecido', position: 9, color: 'gray' },
];
