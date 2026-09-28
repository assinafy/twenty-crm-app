import { type DocumentStatus } from 'src/types/document-status';
import { type StoredSigner } from 'src/types/stored-signer';

// The assinafyDocument fields the app reads and writes.
export type AssinafyDocumentRecord = {
  id: string;
  name: string | null;
  status: DocumentStatus | null;
  assinafyDocumentId: string | null;
  assinafyAccountId: string | null;
  assinafyAssignmentId: string | null;
  requestId: string | null;
  templateName: string | null;
  signerCount: number | null;
  signedCount: number | null;
  signers: StoredSigner[] | null;
  sentAt: string | null;
  completedAt: string | null;
  expiresAt: string | null;
  lastSyncedAt: string | null;
  declineReason: string | null;
  lastError: string | null;
  signedDocument: Array<{ fileId: string; label: string; url?: string | null }> | null;
  personId: string | null;
  companyId: string | null;
  opportunityId: string | null;
  updatedAt: string;
};
