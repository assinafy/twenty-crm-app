// An unsent PDF uploaded by prepare. userWorkspaceId is the member who prepared it, or null for a workflow upload.
export type PendingUpload = {
  documentId: string;
  accountId: string;
  userWorkspaceId: string | null;
  createdAt: string;
};
