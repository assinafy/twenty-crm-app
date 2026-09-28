import { type AssinafyDocumentRecord } from 'src/types/assinafy-document-record';

// Every assinafyDocument field AssinafyDocumentRecord carries (genql selection). `satisfies` fails the typecheck when a
// record field is missing or unselected, since the record mapper would read it as null.
export const ASSINAFY_DOCUMENT_SELECTION = {
  id: true,
  name: true,
  status: true,
  assinafyDocumentId: true,
  assinafyAccountId: true,
  assinafyAssignmentId: true,
  requestId: true,
  templateName: true,
  signerCount: true,
  signedCount: true,
  signers: true,
  sentAt: true,
  completedAt: true,
  expiresAt: true,
  lastSyncedAt: true,
  declineReason: true,
  lastError: true,
  signedDocument: { fileId: true, label: true, url: true },
  personId: true,
  companyId: true,
  opportunityId: true,
  updatedAt: true,
} as const satisfies {
  [K in keyof AssinafyDocumentRecord]-?: K extends 'signedDocument' ? { fileId: true; label: true; url: true } : true;
};
