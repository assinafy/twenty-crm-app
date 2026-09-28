import { type AssinafyDocumentRecord } from 'src/types/assinafy-document-record';

// Cancel deletes a pending request in Assinafy; remove soft-deletes a record that has nothing to cancel there.
export const getDocumentActions = (
  record: Pick<AssinafyDocumentRecord, 'status' | 'assinafyDocumentId' | 'signers'>,
): { cancel: boolean; remove: boolean; resendSignerIds: string[] } => {
  const pending = record.status === 'PENDING_SIGNATURE';

  return {
    cancel: pending,
    remove: record.status === 'FAILED' || (record.status === 'UNCERTAIN' && record.assinafyDocumentId === null),
    // Only a signer who already received the invitation and has not signed can get it again.
    resendSignerIds: pending
      ? (record.signers ?? [])
          .filter((signer) => signer.notified === true && signer.completed !== true)
          .map((signer) => signer.id)
      : [],
  };
};
