import { buildStoredSigner } from 'src/__tests__/fixtures/build-stored-signer';
import { type AssinafyDocumentRecord } from 'src/types/assinafy-document-record';

// A sent PDF request waiting for its only signer.
export const buildDocumentRecord = (overrides: Partial<AssinafyDocumentRecord> = {}): AssinafyDocumentRecord => ({
  id: '4c0ff1d6-0f5c-4a57-9d44-7c2b6c1f2a10',
  name: 'Service agreement',
  status: 'PENDING_SIGNATURE',
  assinafyDocumentId: 'doc-1',
  assinafyAccountId: 'acc-1',
  assinafyAssignmentId: 'asg-1',
  requestId: '9b8e7c1a-3f0d-4e5b-8a61-2d4f6b8c0e12',
  templateName: null,
  signerCount: 1,
  signedCount: 0,
  signers: [buildStoredSigner()],
  sentAt: '2026-09-20T12:00:00.000Z',
  completedAt: null,
  expiresAt: null,
  lastSyncedAt: null,
  declineReason: null,
  lastError: null,
  signedDocument: null,
  personId: '0d6b2c8e-5a41-4f7e-9c3b-1e2a4d6f8b90',
  companyId: null,
  opportunityId: null,
  updatedAt: '2026-09-20T12:00:00.000Z',
  ...overrides,
});
