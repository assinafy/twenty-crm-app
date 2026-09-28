import { type AssinafyDocumentNode } from 'src/types/assinafy-document-node';
import { type AssinafyDocumentRecord } from 'src/types/assinafy-document-record';
import { type StoredSigner } from 'src/types/stored-signer';

// Twenty stores unset TEXT fields as NULL but returns them as '', so those are normalized back to null here, the
// single place every record read goes through.

export const toAssinafyDocumentRecord = (node: AssinafyDocumentNode): AssinafyDocumentRecord => ({
  id: node.id,
  name: node.name || null,
  status: node.status || null,
  assinafyDocumentId: node.assinafyDocumentId || null,
  assinafyAccountId: node.assinafyAccountId || null,
  assinafyAssignmentId: node.assinafyAssignmentId || null,
  requestId: node.requestId || null,
  templateName: node.templateName || null,
  signerCount: node.signerCount ?? null,
  signedCount: node.signedCount ?? null,
  // Only this app writes the field, always as a StoredSigner array.
  signers: Array.isArray(node.signers) ? (node.signers as StoredSigner[]) : null,
  sentAt: node.sentAt ?? null,
  completedAt: node.completedAt ?? null,
  expiresAt: node.expiresAt ?? null,
  lastSyncedAt: node.lastSyncedAt ?? null,
  declineReason: node.declineReason || null,
  lastError: node.lastError || null,
  signedDocument:
    node.signedDocument?.flatMap((file) =>
      file ? [{ fileId: file.fileId, label: file.label, url: file.url ?? null }] : [],
    ) ?? null,
  personId: node.personId ?? null,
  companyId: node.companyId ?? null,
  opportunityId: node.opportunityId ?? null,
  updatedAt: node.updatedAt,
});
