import { type IDocumentDetailsResponse } from '@assinafy/sdk';

import { DOCUMENT_STATUS } from 'src/constants/document-status';
import { type AssinafyDocumentPatch } from 'src/types/assinafy-document-patch';
import { type AssinafyDocumentRecord } from 'src/types/assinafy-document-record';
import { isFinalStatus } from 'src/utils/is-final-status.util';
import { mapAssignmentSigners } from 'src/utils/map-assignment-signers.util';
import { mapAssinafyStatus } from 'src/utils/map-assinafy-status.util';
import { sanitizeProviderMessage } from 'src/utils/sanitize-provider-message.util';

// The decline reason is free text typed by the signer: it gets the same redaction and length cap as provider messages.
// The redaction is idempotent, so a stored reason passes through unchanged.
const sanitizeDeclineReason = (reason: unknown): string | null =>
  (typeof reason === 'string' && sanitizeProviderMessage(reason)) || null;

export const buildDocumentSyncPatch = ({
  record,
  details,
  storedFiles,
  allArtifactsStored,
  now,
}: {
  record: AssinafyDocumentRecord;
  details: IDocumentDetailsResponse;
  storedFiles: Array<{ fileId: string; label: string }> | null;
  allArtifactsStored: boolean;
  now: Date;
}): AssinafyDocumentPatch => {
  const assignment = details.assignment;
  const frozenStatus = isFinalStatus(record.status) ? record.status : null;
  const mapped = mapAssinafyStatus(details.status, {
    sent: record.sentAt !== null || record.assinafyAssignmentId !== null || Boolean(assignment),
  });
  // Signed only once every signed PDF is in Twenty; until then the next sync retries the downloads.
  const filesPending = frozenStatus === null && mapped === DOCUMENT_STATUS.CERTIFICATED && !allArtifactsStored;
  const status = frozenStatus ?? (filesPending ? DOCUMENT_STATUS.CERTIFICATING : mapped);

  // Without an assignment Assinafy tells nothing about signers, so the stored ones and their counts stay.
  let progress: AssinafyDocumentPatch = {};
  if (assignment) {
    const signers = mapAssignmentSigners(assignment, record.signers, details.declined_by?.id);
    progress = {
      assinafyAssignmentId: assignment.id,
      signers,
      signerCount: assignment.summary?.signer_count ?? signers.length,
      signedCount: assignment.summary?.completed_count ?? signers.filter((signer) => signer.completed).length,
      ...(assignment.expires_at === undefined ? {} : { expiresAt: assignment.expires_at }),
    };
  }

  return {
    status,
    ...progress,
    ...(status === DOCUMENT_STATUS.CERTIFICATED ? { signedCount: progress.signerCount ?? record.signerCount } : {}),
    declineReason: sanitizeDeclineReason(details.decline_reason) ?? sanitizeDeclineReason(record.declineReason),
    completedAt:
      record.completedAt ??
      (isFinalStatus(status) ? details.updated_at || now.toISOString() : null),
    ...(storedFiles ? { signedDocument: storedFiles } : {}),
    lastSyncedAt: now.toISOString(),
    // A kept final status keeps its error code (e.g. why a send failed).
    ...(frozenStatus === null ? { lastError: filesPending ? 'SIGNED_FILES_PENDING' : null } : {}),
  };
};
