import { DOCUMENT_STATUS } from 'src/constants/document-status';
import { type AssinafyDocumentRecord } from 'src/types/assinafy-document-record';
import { type DocumentSummary } from 'src/types/document-summary';

export const toDocumentSummary = (record: AssinafyDocumentRecord): DocumentSummary => ({
  documentRecordId: record.id,
  status: record.status ?? DOCUMENT_STATUS.UNKNOWN,
  name: record.name,
  signerCount: record.signerCount ?? 0,
  signedCount: record.signedCount ?? 0,
  signers: record.signers ?? [],
  declineReason: record.declineReason,
  sentAt: record.sentAt,
  completedAt: record.completedAt,
  expiresAt: record.expiresAt,
  lastSyncedAt: record.lastSyncedAt,
  lastError: record.lastError,
});
