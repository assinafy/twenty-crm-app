import { type AssinafyDocumentFilter } from 'src/types/assinafy-document-filter';

export const DOCUMENT_STATUS = {
  SENDING: 'SENDING',
  PENDING_SIGNATURE: 'PENDING_SIGNATURE',
  PENDING_IDENTITY_REVIEW: 'PENDING_IDENTITY_REVIEW',
  CERTIFICATING: 'CERTIFICATING',
  CERTIFICATED: 'CERTIFICATED',
  REJECTED_BY_SIGNER: 'REJECTED_BY_SIGNER',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
  FAILED: 'FAILED',
  UNCERTAIN: 'UNCERTAIN',
  UNKNOWN: 'UNKNOWN',
} as const;

// Statuses a sync never moves away from. EXPIRED is absent because Assinafy can extend a deadline.
export const FINAL_DOCUMENT_STATUSES: readonly string[] = [
  DOCUMENT_STATUS.CERTIFICATED,
  DOCUMENT_STATUS.REJECTED_BY_SIGNER,
  DOCUMENT_STATUS.CANCELLED,
  DOCUMENT_STATUS.FAILED,
];

// Statuses the background sync keeps polling (plus UNCERTAIN with a document id and stale SENDING).
export const SYNCABLE_DOCUMENT_STATUSES: readonly string[] = [
  DOCUMENT_STATUS.PENDING_SIGNATURE,
  DOCUMENT_STATUS.PENDING_IDENTITY_REVIEW,
  DOCUMENT_STATUS.CERTIFICATING,
  DOCUMENT_STATUS.UNKNOWN,
];

// Earlier versions froze provider processing failures; a rejected send always has an error code and no sentAt.
export const LEGACY_PROCESSING_FAILURE_FILTER: AssinafyDocumentFilter = {
  status: { eq: DOCUMENT_STATUS.FAILED },
  and: [
    { or: [{ lastError: { is: 'NULL' } }, { lastError: { eq: '' } }] },
    {
      or: [
        { sentAt: { is: 'NOT_NULL' } },
        { and: [{ assinafyAssignmentId: { is: 'NOT_NULL' } }, { assinafyAssignmentId: { neq: '' } }] },
      ],
    },
  ],
};
