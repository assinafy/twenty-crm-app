import { type DocumentStatus } from 'src/types/document-status';
import { type SignerState } from 'src/types/signer-state';
import { type StoredSigner } from 'src/types/stored-signer';

// Server-safe decision order shared by every place that describes a signer, so they never disagree.
export const getSignerState = (signer: StoredSigner, status: DocumentStatus | null): SignerState => {
  // Assinafy only certifies once everyone signed, even when it did not report each signer's completion.
  if (signer.completed === true || status === 'CERTIFICATING' || status === 'CERTIFICATED') return 'SIGNED';
  if (signer.declined) return 'DECLINED';
  if (signer.deliveryFailed) return 'DELIVERY_FAILED';
  // A cancelled or declined request is closed: nobody else is invited or signs. Completion unknown (Assinafy reports
  // it only to the document owner) keeps the invited state, since the signer may have signed.
  if (
    (status === 'CANCELLED' || status === 'REJECTED_BY_SIGNER') &&
    (signer.completed === false || signer.notified === false)
  ) {
    return 'NOT_SIGNED';
  }
  if (signer.notified !== false) return 'INVITED';
  // In a signing order, later steps are notified once the earlier ones signed; the first step has no one to wait for.
  return signer.step !== null && signer.step > 1 ? 'WAITING' : 'NOT_INVITED';
};
