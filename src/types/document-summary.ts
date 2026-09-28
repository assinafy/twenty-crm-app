import { type DocumentStatus } from 'src/types/document-status';
import { type StoredSigner } from 'src/types/stored-signer';

// Returned by send, refresh, resend and cancel.
export type DocumentSummary = {
  documentRecordId: string;
  status: DocumentStatus;
  name: string | null;
  signerCount: number;
  signedCount: number;
  signers: StoredSigner[];
  declineReason: string | null;
  sentAt: string | null;
  completedAt: string | null;
  expiresAt: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
};
