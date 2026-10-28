import { DOCUMENT_STATUS } from 'src/constants/document-status';
import { type DocumentStatus } from 'src/types/document-status';

// A document still processing its upload already accepts a virtual assignment, so once sent it awaits signatures.
const DRAFT_STATUSES = ['uploading', 'uploaded', 'metadata_processing', 'metadata_ready'];

const STATUS_BY_ASSINAFY_STATUS = new Map<string, DocumentStatus>([
  ['pending_signature', DOCUMENT_STATUS.PENDING_SIGNATURE],
  ['pending_identity_review', DOCUMENT_STATUS.PENDING_IDENTITY_REVIEW],
  ['certificating', DOCUMENT_STATUS.CERTIFICATING],
  ['certificated', DOCUMENT_STATUS.CERTIFICATED],
  ['rejected_by_signer', DOCUMENT_STATUS.REJECTED_BY_SIGNER],
  ['rejected_by_user', DOCUMENT_STATUS.CANCELLED],
  ['expired', DOCUMENT_STATUS.EXPIRED],
  ['failed', DOCUMENT_STATUS.FAILED],
]);

export const mapAssinafyStatus = (assinafyStatus: string, options: { sent: boolean }): DocumentStatus => {
  const status = assinafyStatus.toLowerCase();
  if (DRAFT_STATUSES.includes(status)) {
    return options.sent ? DOCUMENT_STATUS.PENDING_SIGNATURE : DOCUMENT_STATUS.UNCERTAIN;
  }
  // Assinafy can recover a processing failure after signing and certify the document later.
  if (status === 'failed' && options.sent) return DOCUMENT_STATUS.UNKNOWN;
  return STATUS_BY_ASSINAFY_STATUS.get(status) ?? DOCUMENT_STATUS.UNKNOWN;
};
