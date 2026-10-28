import { selectDocumentCredential } from 'src/assinafy-client/select-document-credential';
import { PENDING_UPLOAD_TTL_MS } from 'src/constants/limits';
import { deleteUnsentUpload } from 'src/services/delete-unsent-upload.service';
import { findOwnPendingUpload } from 'src/services/find-own-pending-upload.service';
import { type DiscardInput } from 'src/types/discard-input';
import { type MemberHandlerContext } from 'src/types/member-handler-context';
import { AppFailure } from 'src/utils/app-failure.util';

// Only uploads this member prepared here can be discarded. Fresh uploads stay pending for the purge: a concurrent
// send may still claim them. After the TTL, every accepted send has already passed the one-hour cutoff gap.
export const discardUploadHandler = async (
  { assinafyDocumentId, accountId }: DiscardInput,
  ctx: MemberHandlerContext,
): Promise<Record<string, never>> => {
  const pending = await findOwnPendingUpload(assinafyDocumentId, accountId, ctx.userWorkspaceId);
  const createdAt = pending ? Date.parse(pending.createdAt) : Number.NaN;
  if (!Number.isFinite(createdAt)) {
    throw new AppFailure('INVALID_STATE', 'Só é possível descartar um PDF que você carregou e que ainda não foi enviado.');
  }
  if (createdAt + PENDING_UPLOAD_TTL_MS > ctx.now().getTime()) return {};

  const resolved = await selectDocumentCredential(ctx, accountId);

  await deleteUnsentUpload(resolved, assinafyDocumentId, ctx.appCore);
  return {};
};
