import { kv } from 'twenty-sdk/logic-function';

import { KV_PENDING_UPLOADS } from 'src/constants/kv-keys';
import { MAX_PENDING_UPLOADS } from 'src/constants/limits';
import { readPendingUploads } from 'src/services/read-pending-uploads.service';
import { type PendingUpload } from 'src/types/pending-upload';
import { errorName } from 'src/utils/error-name.util';

// Best-effort, never throws. Read-modify-write without a lock, so concurrent writes can drop an entry, and only the
// newest MAX_PENDING_UPLOADS entries are kept. A dropped upload outlives the purge, and the discard route, prepare
// reuse and member sends refuse it.
export const rememberPendingUpload = async (
  upload: Omit<PendingUpload, 'createdAt'>,
  now: Date,
): Promise<void> => {
  try {
    const entries = (await readPendingUploads()).filter((entry) => entry.documentId !== upload.documentId);
    const merged = [...entries, { ...upload, createdAt: now.toISOString() }];
    if (merged.length > MAX_PENDING_UPLOADS) {
      console.warn('[assinafy] rememberPendingUpload evicted entries', {
        code: 'PENDING_UPLOADS_EVICTED',
        count: merged.length - MAX_PENDING_UPLOADS,
      });
    }
    await kv.set(KV_PENDING_UPLOADS, merged.slice(-MAX_PENDING_UPLOADS));
  } catch (error) {
    console.warn('[assinafy] rememberPendingUpload failed', {
      name: errorName(error),
    });
  }
};
