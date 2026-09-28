import { type IDocumentDetailsResponse } from '@assinafy/sdk';

import { DOCUMENT_STATUS } from 'src/constants/document-status';
import { updateAssinafyDocument } from 'src/data/update-assinafy-document';
import { uploadSignedFile } from 'src/data/upload-signed-file';
import { type AssinafyDocumentPatch } from 'src/types/assinafy-document-patch';
import { type AssinafyDocumentRecord } from 'src/types/assinafy-document-record';
import { type HandlerContext } from 'src/types/handler-context';
import { type ResolvedCredential } from 'src/types/resolved-credential';
import { AppFailure } from 'src/utils/app-failure.util';
import { buildDocumentSyncPatch } from 'src/utils/build-document-sync-patch.util';
import { errorName } from 'src/utils/error-name.util';
import { isFinalStatus } from 'src/utils/is-final-status.util';
import { isSendLeaseActive } from 'src/utils/is-send-lease-active.util';
import { isUnsentDocument } from 'src/utils/is-unsent-document.util';
import { isWithinSendLease } from 'src/utils/is-within-send-lease.util';
import { signedFileLabel } from 'src/utils/signed-file-label.util';
import { toAppError } from 'src/utils/to-app-error.util';

type SyncContext = Pick<HandlerContext, 'appCore' | 'appMetadata' | 'now'>;

// Stores the signed PDFs of a certificated document under the current name: `certificated` always, `pades` when
// Assinafy lists it. Files already stored under an expected label are kept; a failed download or upload leaves
// `complete` false so the next sync retries it.
const storeSignedFiles = async (
  ctx: SyncContext,
  { client }: ResolvedCredential,
  record: AssinafyDocumentRecord,
  details: IDocumentDetailsResponse,
): Promise<{ files: Array<{ fileId: string; label: string }> | null; complete: boolean }> => {
  const artifacts: Array<'certificated' | 'pades'> = details.artifacts?.pades
    ? ['certificated', 'pades']
    : ['certificated'];
  const expected = artifacts.map((artifact) => ({ artifact, label: signedFileLabel(record.name, artifact) }));
  const stored = record.signedDocument ?? [];
  // Only expected labels survive, so a renamed record never exceeds the field's two files.
  const files = stored
    .filter((file) => expected.some(({ label }) => label === file.label))
    .map(({ fileId, label }) => ({ fileId, label }));
  let changed = files.length !== stored.length;
  let complete = true;

  for (const { artifact, label } of expected) {
    if (files.some((file) => file.label === label)) {
      continue;
    }
    try {
      const buffer = await client.documents.download(details.id, artifact);
      files.push(await uploadSignedFile(ctx.appMetadata, { buffer, filename: label }));
      changed = true;
    } catch (error) {
      complete = false;
      console.warn('[assinafy] storing a signed file failed', { artifact, code: toAppError(error, 'read').code });
    }
  }

  return { files: changed ? files : null, complete };
};

// An UNCERTAIN (or abandoned SENDING) record learns from Assinafy whether its request went out.
const resolveUnconfirmedSend = (
  record: AssinafyDocumentRecord,
  details: IDocumentDetailsResponse,
  patch: AssinafyDocumentPatch,
  now: Date,
): AssinafyDocumentPatch => {
  if (!isUnsentDocument(details)) {
    // sentAt keeps the record in the background sync window.
    return { ...patch, sentAt: record.sentAt ?? now.toISOString() };
  }
  // A request that timed out may still be landing in Assinafy: conclude only once it no longer could.
  if (isWithinSendLease(record.updatedAt, now)) {
    return { ...patch, status: DOCUMENT_STATUS.UNCERTAIN, lastError: record.lastError };
  }
  return { ...patch, status: DOCUMENT_STATUS.FAILED, lastError: 'NOT_SENT' };
};

const syncFromAssinafy = async (
  ctx: SyncContext,
  record: AssinafyDocumentRecord,
  resolved: ResolvedCredential,
  documentId: string,
  now: Date,
): Promise<AssinafyDocumentRecord> => {
  let details: IDocumentDetailsResponse;
  try {
    details = await resolved.client.documents.details(documentId);
  } catch (error) {
    const failure = toAppError(error, 'read');
    if (failure.code !== 'NOT_FOUND') {
      throw failure;
    }
    // Deleted in Assinafy (or never kept): nothing can be signed any more. A final status stays with its error code
    // (e.g. why a send failed, whose upload the purge deleted).
    return updateAssinafyDocument(ctx.appCore, record.id, {
      ...(isFinalStatus(record.status)
        ? {}
        : {
            status: DOCUMENT_STATUS.CANCELLED,
            completedAt: record.completedAt ?? now.toISOString(),
            lastError: 'NOT_FOUND',
          }),
      lastSyncedAt: now.toISOString(),
    });
  }

  const signed =
    details.status.toLowerCase() === 'certificated' && record.status !== DOCUMENT_STATUS.CERTIFICATED
      ? await storeSignedFiles(ctx, resolved, record, details)
      : { files: null, complete: true };
  const patch = buildDocumentSyncPatch({
    record,
    details,
    storedFiles: signed.files,
    allArtifactsStored: signed.complete,
    now,
  });
  const unconfirmed = record.status === DOCUMENT_STATUS.UNCERTAIN || record.status === DOCUMENT_STATUS.SENDING;

  return updateAssinafyDocument(
    ctx.appCore,
    record.id,
    unconfirmed ? resolveUnconfirmedSend(record, details, patch, now) : patch,
  );
};

// Refreshes one record from Assinafy with the application client. Any failure other than a missing document is
// recorded on the record (lastSyncedAt rotates it in the background queue; a final status keeps its error code) and
// rethrown as an AppFailure. `resolved` may be null only for a record without an Assinafy document, which needs no
// Assinafy call.
export const syncAssinafyDocument = async (
  ctx: SyncContext,
  record: AssinafyDocumentRecord,
  resolved: ResolvedCredential | null,
): Promise<AssinafyDocumentRecord> => {
  const now = ctx.now();
  // The send that owns this record may still be running.
  if (isSendLeaseActive(record, now)) {
    return record;
  }

  try {
    if (record.assinafyDocumentId === null) {
      // A template send that never confirmed has nothing to look up; the user removes it.
      return record.status === DOCUMENT_STATUS.SENDING
        ? await updateAssinafyDocument(ctx.appCore, record.id, {
            status: DOCUMENT_STATUS.UNCERTAIN,
            lastError: 'UNCERTAIN',
            lastSyncedAt: now.toISOString(),
          })
        : record;
    }
    if (resolved === null) {
      throw new AppFailure('INTERNAL', 'Nenhuma credencial para consultar a Assinafy.');
    }
    return await syncFromAssinafy(ctx, record, resolved, record.assinafyDocumentId, now);
  } catch (error) {
    const failure = toAppError(error, 'read');
    try {
      await updateAssinafyDocument(ctx.appCore, record.id, {
        lastSyncedAt: now.toISOString(),
        // A final status keeps its error code: a refresh failure is only reported to the caller, since no later sync
        // of a final record would clear it.
        ...(isFinalStatus(record.status) ? {} : { lastError: failure.code }),
      });
    } catch (updateError) {
      console.warn('[assinafy] recording a sync failure failed', {
        code: failure.code,
        name: errorName(updateError),
      });
    }
    throw failure;
  }
};
