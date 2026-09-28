import { kv } from 'twenty-sdk/logic-function';

import { KV_PENDING_UPLOADS } from 'src/constants/kv-keys';
import { type PendingUpload } from 'src/types/pending-upload';

const toPendingUpload = (value: unknown): PendingUpload[] => {
  const entry = value as Partial<PendingUpload> | null;
  if (
    typeof entry !== 'object' ||
    entry === null ||
    typeof entry.documentId !== 'string' ||
    typeof entry.accountId !== 'string' ||
    typeof entry.createdAt !== 'string'
  ) {
    return [];
  }
  const { documentId, accountId, createdAt } = entry;
  // Entries stored before the preparing member was recorded belong to no member.
  const userWorkspaceId = typeof entry.userWorkspaceId === 'string' ? entry.userWorkspaceId : null;
  return [{ documentId, accountId, userWorkspaceId, createdAt }];
};

// Unsent PDFs uploaded by prepare, oldest first, kept so the cron can delete the abandoned ones and the discard route
// can check who prepared them. Malformed entries are dropped.
export const readPendingUploads = async (): Promise<PendingUpload[]> => {
  const stored = await kv.get<unknown>(KV_PENDING_UPLOADS);
  return Array.isArray(stored) ? stored.flatMap(toPendingUpload) : [];
};
