import { kv } from 'twenty-sdk/logic-function';

import { KV_PENDING_UPLOADS } from 'src/constants/kv-keys';
import { readPendingUploads } from 'src/services/read-pending-uploads.service';
import { errorName } from 'src/utils/error-name.util';

// Best-effort, never throws.
export const forgetPendingUpload = async (documentId: string): Promise<void> => {
  try {
    const entries = await readPendingUploads();
    const kept = entries.filter((entry) => entry.documentId !== documentId);
    if (kept.length !== entries.length) {
      await kv.set(KV_PENDING_UPLOADS, kept);
    }
  } catch (error) {
    console.warn('[assinafy] forgetPendingUpload failed', { name: errorName(error) });
  }
};
