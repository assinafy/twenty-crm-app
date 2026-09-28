import { PENDING_UPLOAD_SEND_CUTOFF_MS } from 'src/constants/limits';
import { findOwnPendingUpload } from 'src/services/find-own-pending-upload.service';
import { AppFailure } from 'src/utils/app-failure.util';

// A member re-estimates or sends only an upload they prepared here, younger than PENDING_UPLOAD_SEND_CUTOFF_MS. The
// purge only looks at an entry once it is PENDING_UPLOAD_TTL_MS old, an hour later, so every send accepted here has
// claimed its SENDING record by then and the purge's reference check sees it. (Workflow sends skip this check: they
// send the upload they made seconds earlier in the same run.) An entry lost to the unlocked pending-upload list is
// refused too: the member reviews again, which uploads the PDF again.
export const assertSendableUpload = async (
  documentId: string,
  accountId: string,
  userWorkspaceId: string | null,
  now: Date,
): Promise<void> => {
  const entry = await findOwnPendingUpload(documentId, accountId, userWorkspaceId);
  if (entry === undefined || Date.parse(entry.createdAt) + PENDING_UPLOAD_SEND_CUTOFF_MS <= now.getTime()) {
    throw new AppFailure('INVALID_STATE', 'O PDF carregado expirou ou mudou. Revise a solicitação novamente.');
  }
};
