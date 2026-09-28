import { readPendingUploads } from 'src/services/read-pending-uploads.service';
import { type PendingUpload } from 'src/types/pending-upload';

// The pending-upload entry of an upload this member prepared in this Assinafy workspace. A caller without a member
// owns nothing: workflow uploads are stored with no member, and a null member must never match them.
export const findOwnPendingUpload = async (
  documentId: string,
  accountId: string,
  userWorkspaceId: string | null,
): Promise<PendingUpload | undefined> => {
  if (userWorkspaceId === null) {
    return undefined;
  }
  return (await readPendingUploads()).find(
    (entry) =>
      entry.documentId === documentId && entry.accountId === accountId && entry.userWorkspaceId === userWorkspaceId,
  );
};
