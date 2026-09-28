import { selectDocumentCredential } from 'src/assinafy-client/select-document-credential';
import { deleteUnsentUpload } from 'src/services/delete-unsent-upload.service';
import { findOwnPendingUpload } from 'src/services/find-own-pending-upload.service';
import { type DiscardInput } from 'src/types/discard-input';
import { type MemberHandlerContext } from 'src/types/member-handler-context';
import { AppFailure } from 'src/utils/app-failure.util';

// The send flow drops the PDF it uploaded when the user changes the document or closes the flow before sending. Only
// an upload the app prepared for this member, in this Assinafy workspace, can be discarded.
export const discardUploadHandler = async (
  { assinafyDocumentId, accountId }: DiscardInput,
  ctx: MemberHandlerContext,
): Promise<Record<string, never>> => {
  if (!(await findOwnPendingUpload(assinafyDocumentId, accountId, ctx.userWorkspaceId))) {
    throw new AppFailure('INVALID_STATE', 'Só é possível descartar um PDF que você carregou e que ainda não foi enviado.');
  }

  const resolved = await selectDocumentCredential(ctx, accountId);

  await deleteUnsentUpload(resolved, assinafyDocumentId, ctx.appCore);
  return {};
};
