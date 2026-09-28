import { ApiError } from '@assinafy/sdk';
import { kv } from 'twenty-sdk/logic-function';
import { type CoreApiClient } from 'twenty-client-sdk/core';

import { KV_PENDING_UPLOADS } from 'src/constants/kv-keys';
import { PENDING_UPLOAD_MAX_AGE_MS, PENDING_UPLOAD_TTL_MS } from 'src/constants/limits';
import { findUploadReference } from 'src/data/find-upload-reference';
import { readPendingUploads } from 'src/services/read-pending-uploads.service';
import { type PendingUpload } from 'src/types/pending-upload';
import { type ResolvedCredential } from 'src/types/resolved-credential';
import { errorName } from 'src/utils/error-name.util';
import { isDeletableUpload } from 'src/utils/is-deletable-upload.util';
import { toAppError } from 'src/utils/to-app-error.util';

// deleted: counted and forgotten; gone: nothing left to purge, forgotten; retry: kept until PENDING_UPLOAD_MAX_AGE_MS.
type PurgeOutcome = 'deleted' | 'gone' | 'retry';

const purgeEntry = async (
  resolved: ResolvedCredential,
  entry: PendingUpload,
  appCore: CoreApiClient,
): Promise<PurgeOutcome> => {
  try {
    const details = await resolved.client.documents.details(entry.documentId);
    // Sent (in or outside the app) or moved: never deleted, and nothing left to purge.
    if (!isDeletableUpload(details, entry.accountId)) return 'gone';
    // Checked last, right before the delete: a SENDING or UNCERTAIN send may still assign the upload, so the
    // entry waits until that send resolves. The check only sees claims already made, which covers every send:
    // sends refuse uploads older than PENDING_UPLOAD_SEND_CUTOFF_MS, an hour younger than this entry, so any send
    // that could still assign this upload claimed its record long before.
    if (await findUploadReference(appCore, entry.documentId)) return 'retry';
    await resolved.client.documents.delete(entry.documentId);
    return 'deleted';
  } catch (error) {
    if (error instanceof ApiError) {
      // 404: already gone.
      if (error.statusCode === 404) return 'gone';
      // 400: Assinafy cannot delete the upload yet (still processing); a later run retries until the max age.
      if (error.statusCode === 400) return 'retry';
    }
    console.warn('[assinafy] purging a pending upload failed', { code: toAppError(error, 'mutation').code });
    return 'retry';
  }
};

// Deletes unsent uploads older than PENDING_UPLOAD_TTL_MS whose workspace a credential reaches; returns how many.
// Deleting a sent document cancels it for every signer, so only this account's unsent drafts (or failed, unassigned
// uploads) qualify, and only when no send record other than a FAILED one points at them. Best-effort, never throws:
// an entry that is not deleted (no credential reaches it, a send still references it, or its check or delete fails)
// stays for the next run until PENDING_UPLOAD_MAX_AGE_MS, then it is forgotten without being deleted, so it cannot keep
// every run busy.
export const purgePendingUploads = async (
  credentials: ResolvedCredential[],
  now: Date,
  appCore: CoreApiClient,
): Promise<number> => {
  try {
    const entries = await readPendingUploads();
    const kept: typeof entries = [];
    let deleted = 0;

    for (const entry of entries) {
      const createdAt = Date.parse(entry.createdAt);
      if (createdAt + PENDING_UPLOAD_TTL_MS > now.getTime()) {
        kept.push(entry);
        continue;
      }
      const expired = createdAt + PENDING_UPLOAD_MAX_AGE_MS <= now.getTime();
      const resolved = credentials.find((credential) => credential.accountId === entry.accountId);
      const outcome = resolved ? await purgeEntry(resolved, entry, appCore) : 'retry';
      if (outcome === 'deleted') deleted += 1;
      if (outcome === 'retry' && !expired) kept.push(entry);
    }

    if (kept.length !== entries.length) {
      // kv has no compare-and-swap: re-read and remove only what this run dropped, so entries written during the loop
      // survive.
      const dropped = new Set(entries.filter((entry) => !kept.includes(entry)).map(({ documentId }) => documentId));
      const current = await readPendingUploads();
      await kv.set(
        KV_PENDING_UPLOADS,
        current.filter(({ documentId }) => !dropped.has(documentId)),
      );
    }
    return deleted;
  } catch (error) {
    console.warn('[assinafy] purgePendingUploads failed', { name: errorName(error) });
    return 0;
  }
};
