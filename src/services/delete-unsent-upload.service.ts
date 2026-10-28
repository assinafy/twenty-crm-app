import { ApiError } from '@assinafy/sdk';
import { type CoreApiClient } from 'twenty-client-sdk/core';

import { findUploadReference } from 'src/data/find-upload-reference';
import { forgetPendingUpload } from 'src/services/forget-pending-upload.service';
import { type ResolvedCredential } from 'src/types/resolved-credential';
import { AppFailure } from 'src/utils/app-failure.util';
import { isDeletableUpload } from 'src/utils/is-deletable-upload.util';
import { toAppError } from 'src/utils/to-app-error.util';

// Deleting a sent document cancels it for every signer, so only this account's unsent (or failed, unassigned) uploads
// qualify, and only when no record other than a FAILED send points at them. The record check runs last, right before
// the delete, but it only sees claims made before it. Discard and purge wait until PENDING_UPLOAD_TTL_MS, an hour
// after sends refuse uploads at PENDING_UPLOAD_SEND_CUTOFF_MS, so every accepted send has already claimed its record.
export const deleteUnsentUpload = async (
  resolved: ResolvedCredential,
  documentId: string,
  appCore: CoreApiClient,
): Promise<void> => {
  const { documents } = resolved.client;

  try {
    const details = await documents.details(documentId);
    if (!isDeletableUpload(details, resolved.accountId)) {
      throw new AppFailure('INVALID_STATE', 'Só é possível descartar um PDF carregado que ainda não foi enviado.');
    }
    if (await findUploadReference(appCore, documentId)) {
      throw new AppFailure('INVALID_STATE', 'Este PDF está sendo usado em um envio e não pode ser descartado.');
    }
    await documents.delete(documentId);
  } catch (error) {
    // 400: Assinafy is still processing the upload; keeping it remembered lets the pending-upload purge retry.
    if (error instanceof ApiError && error.statusCode === 400) return;
    // 404: already gone.
    if (!(error instanceof ApiError && error.statusCode === 404)) throw toAppError(error, 'mutation');
  }

  await forgetPendingUpload(documentId);
};
